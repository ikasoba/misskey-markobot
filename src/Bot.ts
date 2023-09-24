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
  private reactionTrainQueue: string[] = [];
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

      if (e.data.body.cw == null) this.trainQueue.push(e.data.body);
      this.reactionTrainQueue.push(e.data.body.id);

      if (0.85 < Math.random()) {
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

    this.stream.addEventListener("notification", async (e) => {
      if (e.data.body.type != "reaction") return;

      await this.trainReaction({
        ...e.data.body.note,
        reactions: {
          [e.data.body.reaction]: 1,
        },
      });
    });

    this.startTrainQueueRunner();
    this.startMonologueRunner();
    this.startReactionTrainQueueRunner();

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

  private startReactionTrainQueueRunner() {
    const run = async () => {
      try {
        console.info(
          "リアクション学習開始",
          this.reactionTrainQueue.slice(-10),
        );
        for (
          let i = 0, count = 0;
          count < 10 && i < 20 && this.reactionTrainQueue.length > 0;
          i++
        ) {
          const noteId = this.reactionTrainQueue.shift()!;
          const note = await this.client.getNote(noteId);

          // 1分30秒後に学習させるため
          if (
            Date.now() - new Date(note.createdAt).getTime() < 1.5 * 60 * 1000
          ) {
            this.reactionTrainQueue.push(noteId);
            continue;
          }
          if (Object.entries(note.reactions).length == 0) {
            continue;
          }
          await this.trainReaction(note);
          count++;
        }
        console.info("リアクション学習終了");
      } finally {
        setTimeout(run, 1000 * 60);
      }
    };

    run();
  }

  async putEmojiReaction(note: MiNote) {
    if (note.text == null) return;
    const emoji = await this.reactionModel.text2emoji(note.text);
    console.info("[emoji]", emoji);
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
        "[Bot#trainNote] note content is null.",
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
  }

  async trainReaction(note: MiNote) {
    if (!note.text) {
      console.info(
        "[Bot#trainReaction] note content is null.",
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

    await this.reactionModel.train({ ...note, text: content });
  }
}
