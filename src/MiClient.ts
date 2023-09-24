import { MiStream } from "./MiStream.ts";
import { MiNote } from "./types/Note.ts";
import { MiUser } from "./types/User.ts";

export class MiClient {
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

  async getNote(id: string) {
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
      throw new Error(`request failed. ${res.url} ${res.status}`);
    }

    return await res.json() as MiNote;
  }
}
