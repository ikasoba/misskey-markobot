import { tokenizeMfm as tokenize } from "./tokenizer.ts";
import shuffle from "shuffle/mod.ts";

export interface TokenInfo {
  [next: string]: number;
}

export type ProbabilityTable = [string, number][];

/**
 * マルコフ連鎖で生成するやつ
 *
 * アルゴリズムが本当にアッてるのかわからない
 */
export class Markov {
  private wordThreshold = 0.9;

  constructor(private store: Deno.Kv, private maxWords: number = 100) {}

  async study(text: string) {
    const tokens = ["(START)", ...tokenize(text), "(END)"];

    const cache: Record<string, TokenInfo> = {};

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const next = (i + 1) < tokens.length ? tokens[i + 1] : null;
      if (!next) continue;

      let tokenInfo: TokenInfo;
      if (token in cache) tokenInfo = cache[token];
      else {
        tokenInfo = await this.store.get<TokenInfo>([token]).then((x) =>
          x.value
        ) ?? {};
        cache[token] = tokenInfo;
      }

      tokenInfo[next] = (tokenInfo[next] ?? 0) + 1;
      cache[token] = tokenInfo;
    }

    console.info(
      "[markov#study] study success.",
      JSON.stringify(cache, null, "  "),
    );

    for (const k in cache) {
      await this.store.set(
        [k],
        /** シャッフルすることで出力の多様性を高める試み */
        Object.fromEntries(
          shuffle(Object.entries(cache[k])),
        ),
      );
    }
  }

  private createProbabilityTable(token: TokenInfo): ProbabilityTable {
    return shuffle(Object.entries(token)).sort((x, y) => x[1] - y[1]);
  }

  private removeDuplicationFromTable(
    table: ProbabilityTable,
    token: string[],
  ): ProbabilityTable {
    return table.filter((x) => !token.some((y) => x[0] == y));
  }

  async getNextProbabilityTable(
    token: string,
    prevToken: string,
    cache: Record<string, ProbabilityTable>,
  ): Promise<ProbabilityTable> {
    let res;

    if (token in cache) res = cache[token];
    else {
      const tokenInfo = await this.store.get<TokenInfo>([token]).then((x) =>
        x.value
      ) ??
        {};

      res = this.removeDuplicationFromTable(
        this.createProbabilityTable(tokenInfo),
        [token, prevToken],
      );
      cache[token] = res;
    }

    if (res.length == 0) {
      return this.getNextProbabilityTable("(START)", "(START)", cache);
    }

    return res;
  }

  /**
   * @returns 何も学習してないなら `null`
   */
  async generate() {
    const cache: Record<string, ProbabilityTable> = {},
      res = [],
      usedWords = new Set<string>();

    let prevToken = "(START)";
    let prevTable = await this.store.get<TokenInfo>(["(START)"]).then((x) =>
      x.value &&
      shuffle(
        this.removeDuplicationFromTable(
          this.createProbabilityTable(x.value),
          ["(START)"],
        ).map(([k, v]) => [k, 1]),
      ) as ProbabilityTable
    );
    if (prevTable == null) return null;

    const randomChoice = (table: ProbabilityTable, usedWords: Set<string>) => {
      const rnd = Math.floor(
        Math.random() * (table.reduce((p, c) => p + c[1], 0)),
      );

      for (let i = 0; i < table.length; i++) {
        const [token, p] = table[i];

        if (rnd <= p) {
          if (usedWords.has(token)) {
            table[i][1] = table[i][1] * this.wordThreshold;
          } else {
            usedWords.add(token);
          }
          return token;
        }
      }

      const row = table.at(-1)!;
      const token = row[0];

      if (usedWords.has(token)) {
        row[1] = row[1] * this.wordThreshold;
      } else {
        usedWords.add(token);
      }
      return token;
    };

    for (let i = 0; i < this.maxWords && prevToken != "(END)";) {
      const nextToken = randomChoice(prevTable, usedWords);
      let nextTable: ProbabilityTable;

      if (nextToken == "(END)") {
        break;
      }

      nextTable = await this.getNextProbabilityTable(
        nextToken,
        prevToken,
        cache,
      );

      res.push(nextToken);

      prevToken = nextToken;
      prevTable = nextTable;
      i += 1;
    }

    return res.join("");
  }
}
