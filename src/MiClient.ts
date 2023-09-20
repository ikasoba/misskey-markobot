import { MiStream } from "./MiStream.ts";
import { MiNote } from "./types/Note.ts";
import { MiUser } from "./types/User.ts";

export class MiClient {
  constructor(public hostname: string, private token: string) {}

  createStream() {
    return new MiStream(this.token, this.hostname);
  }

  async me() {
    const res = await fetch(`https://${this.hostname}/api/i`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ i: this.token }),
    });
    if (!res.ok) {
      throw new Error(`request failed. ${res.url}`);
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
    const res = await fetch(`https://${this.hostname}/api/notes/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...data, i: this.token }),
    });
    if (!res.ok) {
      throw new Error(`request failed. ${res.url}`);
    }

    const resData = await res.json();
    return resData.createdNote as MiNote;
  }

  async getFollowers(options?: { id: string }) {
    const res = await fetch(`https://${this.hostname}/api/users/followers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...options, i: this.token }),
    });
    if (!res.ok) {
      throw new Error(`request failed. ${res.url}`);
    }

    return await res.json() as MiUser[];
  }

  async follow(id: string) {
    const res = await fetch(`https://${this.hostname}/api/following/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: id, i: this.token }),
    });
    if (!res.ok) {
      throw new Error(`request failed. ${res.url}`);
    }

    return await res.json() as MiUser;
  }
}