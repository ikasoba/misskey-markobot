import { tokenizeMfm as tokenize } from "./tokenizer.ts";

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
  constructor(private store: Deno.Kv) {}

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
        /** シャッフルすることで内容の多様性を高める試み */
        Object.fromEntries(
          Object.entries(cache[k]).sort(() => 0.5 - Math.random()),
        ),
      );
    }
  }

  private createProbabilityTable(token: TokenInfo): ProbabilityTable {
    return Object.entries(token).sort(() => 0.5 - Math.random()).sort((x, y) =>
      y[1] - x[1]
    );
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
    const cache: Record<string, ProbabilityTable> = {}, res = [];

    let prevToken = "(START)";
    let prevTable = await this.store.get<TokenInfo>(["(START)"]).then((x) =>
      x.value &&
      this.removeDuplicationFromTable(
        this.createProbabilityTable(x.value),
        ["(START)"],
      )
    );
    if (prevTable == null) return null;

    const randomChoice = (table: ProbabilityTable) => {
      console.info("[randomChoice] called.", table);
      const rnd = Math.floor(Math.random() * (table[0][1] * 1));

      for (let i = 0; i < table.length; i++) {
        const [token, p] = table[i];

        if (rnd >= p) {
          return token;
        }
      }

      return table.at(-1)![0];
    };

    for (let i = 0; i < 30 && prevToken != "(END)";) {
      const nextToken = randomChoice(prevTable);
      let nextTable: ProbabilityTable;

      if (nextToken == "(END)") break;

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
