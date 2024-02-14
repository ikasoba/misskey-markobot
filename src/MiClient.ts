import { MiStream } from "./MiStream.ts";
import { MiNote } from "./types/Note.ts";
import { MiUser } from "./types/User.ts";
import { TemporaryCache } from "./util/TemporaryCache.ts";

export class MiClient {
  private cache = new TemporaryCache();
  private restrictedWords: string[] = Deno.env.get("RESTRICTED_WORDS") ? Deno.env.get("RESTRICTED_WORDS")!.split(",") : [];

  constructor(
    public hostname: string,
    private token: string,
    private isSSL = true,
  ) {}

  createStream() {
    return new MiStream(this.token, this.hostname, this.isSSL);
  }

  private protocol() {
    return this.isSSL ? "https" : "http";
  }

  async me() {
    const res = await fetch(
      `${this.protocol()}://${this.hostname}/api/i`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ i: this.token }),
      },
    );
    if (!res.ok) {
      throw new Error(`request failed. ${res.url} ${res.status}`);
    }

    return await res.json() as MiUser;
  }

  async createNote(
    data: {
      localOnly?: boolean;
      text?: string;
      replyId?: string;
      renoteId?: string;
      visibility?: "home" | "public" | "followers" | "specified";
    },
  ) {
      //禁止ワードが入っていたらエラーを返す
      if (data.text && this.containsRestrictedWord(data.text)) {
          throw new Error(`禁止用語が入っていたので投稿できませんでした。`);
      }
    const res = await fetch(
      `${this.protocol()}://${this.hostname}/api/notes/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...data, i: this.token }),
      },
    );
    if (!res.ok) {
      throw new Error(`request failed. ${res.url} ${res.status}`);
    }

    const resData = await res.json();
    return resData.createdNote as MiNote;
  }

  async getFollowers(options?: { id: string }) {
    const res = await fetch(
      `${this.protocol()}://${this.hostname}/api/users/followers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...options, i: this.token }),
      },
    );

    if (!res.ok) {
      throw new Error(`request failed. ${res.url} ${res.status}`);
    }

    return await res.json() as MiUser[];
  }

  async follow(id: string) {
    const res = await fetch(
      `${this.protocol()}://${this.hostname}/api/following/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: id, i: this.token }),
      },
    );
    if (!res.ok) {
      throw new Error(`request failed. ${res.url} ${res.status}`);
    }

    return await res.json() as MiUser;
  }

  async putReaction(noteId: string, reaction: string) {
    const res = await fetch(
      `${this.protocol()}://${this.hostname}/api/notes/reactions/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ noteId, reaction, i: this.token }),
      },
    );
    if (!res.ok) {
      throw new Error(`request failed. ${res.url} ${res.status}`);
    }
  }

  async getNote(id: string, enableCache = true) {
    const cacheKey = `get-note:${id}`;
    if (enableCache && this.cache.has(cacheKey)) {
      return (await this.cache.get(cacheKey)!.json()) as MiNote;
    }

    const res = await fetch(
      `${this.protocol()}://${this.hostname}/api/notes/show`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ noteId: id, i: this.token }),
      },
    );

    if (!res.ok) {
      const err = await res.json();
      if (err?.code == "NO_SUCH_NOTE") return null;
      throw new Error(
        `request failed. ${res.url} ${res.status} ${id}`,
      );
    }

    if (enableCache) this.cache.set(cacheKey, res);

    return await res.json() as MiNote;
  }
    private containsRestrictedWord(text: string): boolean {
        for (const word of this.restrictedWords) {
            if (text.includes(word)) {
                return true;
            }
        }
        return false;
    }
}
