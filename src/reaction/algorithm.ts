import MeCab from "deno_mecab/src/MeCab.ts";
import { MiNote } from "../types/Note.ts";
import { ParsedWord } from "deno_mecab/mod.ts";
import { randomChoice } from "../util/random.ts";

type Emojis = Record<string, number>;

export class ReactionShoot {
  constructor(private kv: Deno.Kv, private mecab: MeCab) {}

  /**
   * 文字列の中で多く出てきた文字を抽出
   */
  private async extractWords(text: string) {
    // 意味のないもの以外を取得
    const words = (await this.mecab.parse(text)).filter((x) =>
      !["助詞", "特殊"].some((f) => x.feature.includes(f))
    );

    // 単語が出てきた回数をカウント
    const tmp = new Map<string, number>();
    for (const w of words) {
      tmp.set(w.surface, (tmp.get(w.surface) || 0) + 1);
    }

    const res = [...tmp.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map((
      x,
    ) => x[0]);
    console.log("[words]", res);

    // 単語を多く出てきた順番にソートして上位五位までを抽出
    return res;
  }

  private isLocalEmojiOrUnicodeEmoji(emoji: string) {
    return emoji[0] != ":" || /^:[a-zA-Z_0-9-]+(?:@\.)?:$/.test(emoji);
  }

  async train(note: MiNote) {
    if (note.text == null) return;
    const words = await this.extractWords(note.text);

    console.log("[reaction train] reactions", note.reactions);

    for (const w of words) {
      for (let emoji in note.reactions) {
        if (!this.isLocalEmojiOrUnicodeEmoji(emoji)) continue;

        // ホストの表記はmfmの絵文字の形式とは異なるため消す
        emoji = emoji.replace("@.", "");

        const count = note.reactions[emoji];
        const emojis = await this.kv.get<Emojis>([w]).then((x) =>
          x.value ?? {}
        );

        await this.kv.set([w], {
          ...emojis,
          [emoji]: (emojis[emoji] || 0) + count,
        });
      }
    }
  }

  async text2emoji(text: string): Promise<string | null> {
    const words = await this.extractWords(text);
    const emojiTable: Emojis = {};

    for (const w of words) {
      const emojis = await this.kv.get<Emojis>([w]).then((x) => x.value);
      if (emojis == null) continue;

      for (const k in emojis) {
        emojiTable[k] = (emojiTable[k] ?? 0) + emojis[k];
      }
    }

    const emoji = await randomChoice(Object.entries(emojiTable), null);

    console.log("[emoji]", emojiTable);

    return emoji;
  }
}
