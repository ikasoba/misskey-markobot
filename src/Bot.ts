import { MiClient } from "./MiClient.ts";
import { MiStream } from "./MiStream.ts";
import { MiNote } from "./types/Note.ts";
import * as mfm from "mfm-js/";
import { MiUser } from "./types/User.ts";
import { Markov } from "./Markov.ts";
import { Scheduler } from "./Scheduler.ts";
import { ReactionShoot } from "./reaction/algorithm.ts";

export class Bot {
  private me!: MiUser;
  private trainQueue: MiNote[] = [];
  private followerIds = new Set<string>();

  constructor(
    private stream: MiStream,
    private client: MiClient,
    private markov: Markov,
    private reactionModel: ReactionShoot,
  ) {}

  async start() {
    console.log("初期化中");

    this.me = await this.client.me();
    console.log("ユーザー名", this.me.username);

    this.followerIds = new Set();

    await this.stream.connectServer();
    this.stream.connectMain();
    this.stream.connectTimeline("homeTimeline", { withReplies: false });
    this.stream.setReconnectHandler(async () => {
      await this.stream.connectServer();
      this.stream.connectMain();
      this.stream.connectTimeline("homeTimeline", { withReplies: false });
    });

    this.stream.addEventListener("note", async (e) => {
      console.log("[note]");
      if (
        e.data.type != "note" || !e.data.body.text ||
        e.data.body.userId == this.me.id || e.data.body.channelId != null
      ) return;

      this.trainQueue.push(e.data.body);

      if (0.5 < Math.random()) {
        await this.putEmojiReaction(e.data.body);
      }
    });

    this.stream.addEventListener("followed", async (e) => {
      console.log("[followed]");
      this.followerIds.add(e.data.body.id);
      await this.client.follow(e.data.body.id);
    });

    this.stream.addEventListener("mention", async (e) => {
      console.log("[mention]");

      await this.sendMonologue(e.data.body.id);
    });

    this.startTrainQueueRunner();
    this.startMonologueRunner();

    console.log("準備完了");
  }

  private startMonologueRunner() {
    const getNextHour = () => {
      const date = new Date();

      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours() + 1,
        0,
        0,
        0,
      );
    };
    let count = 0;

    const run = async () => {
      console.info("[定期] 独り言発動");
      await this.sendMonologue();
      count++;

      if (count >= 10) {
        count = 0;
        Scheduler.executeAt(run, getNextHour());
      } else {
        setTimeout(
          run,
          (30 + Math.floor(Math.random() * 31)) * 60 * 1000,
        );
      }
    };

    Scheduler.executeAt(run, getNextHour());
  }

  private startTrainQueueRunner() {
    const run = async () => {
      try {
        console.info("学習開始", this.trainQueue.slice(-10));
        for (let i = 0; i < 50 && this.trainQueue.length > 0; i++) {
          const note = this.trainQueue.shift()!;
          await this.trainNote(note);
        }
        console.info("学習終了");
      } finally {
        setTimeout(run, 1000 * 30);
      }
    };

    run();
  }

  async putEmojiReaction(note: MiNote) {
    if (note.text == null) return;
    const emoji = await this.reactionModel.text2emoji(note.text);
    if (emoji == null) return;

    await this.client.putReaction(note.id, emoji);
  }

  async sendMonologue(replyId?: string) {
    console.info("[monologue] start generation.");
    const text = await this.markov.generate();
    if (text == null) {
      console.info("[monologue] failed generation.");
      return;
    }

    console.info("[monologue]", text);

    await this.client.createNote({
      localOnly: true,
      text,
      visibility: "home",
      replyId,
    });
  }

  async trainNote(note: MiNote) {
    if (!note.text) {
      console.info(
        "[Bot#onMention] note content is null.",
        JSON.stringify(note),
      );
      return;
    }

    const content = note.text.replaceAll(
      new RegExp(
        `@${this.me.username}${this.me.host ? `@${this.me.host}` : ""}`,
        "g",
      ),
      "",
    ).trim();
    console.info("[trainNote]", JSON.stringify(content));

    if (content.length == 0) return;

    await this.markov.study(content);
    await this.reactionModel.train({ ...note, text: content });
  }
}
