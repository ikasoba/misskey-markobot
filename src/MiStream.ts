import { MiNote } from "./types/Note.ts";
import { MiUser } from "./types/User.ts";

export type StreamMessageMap = {
  mention: {
    type: "channel";
    body: {
      type: "mention";
      id: string;
      body: MiNote;
    };
  };
  reply: {
    type: "channel";
    body: {
      type: "reply";
      id: string;
      body: MiNote;
    };
  };
  renote: {
    type: "channel";
    body: {
      type: "renote";
      id: string;
      body: MiNote;
    };
  };
  followed: {
    type: "channel";
    body: {
      type: "followed";
      id: string;
      body: MiUser;
    };
  };
  note: {
    type: "channel";
    body: {
      type: "note";
      id: string;
      body: MiNote;
    };
  };
};

export class MiStreamEvent<
  K extends keyof StreamMessageMap = keyof StreamMessageMap,
> extends Event {
  constructor(
    type: (StreamMessageMap[K])["body"]["type"],
    readonly data: (StreamMessageMap[K])["body"],
    eventInitDict?: EventInit,
  ) {
    super(type, eventInitDict);
  }
}

export class MiStream {
  private eventTarget = new EventTarget();
  private ws?: WebSocket | null = null;

  constructor(private token: string, private hostname: string) {}

  async connectServer(protocol = "wss") {
    const url = new URL("/streaming", `${protocol}://${this.hostname}`);
    url.searchParams.set("i", this.token);

    await this.connectWs(url);
  }

  private connectWs(url: URL) {
    return new Promise<void>((resolve) => {
      this.ws = new WebSocket(url);
      this.ws.binaryType = "blob";

      this.ws.addEventListener("open", () => resolve());

      this.ws.addEventListener("close", () => {
        console.info("[MiStream] disconnected stream.");

        this.connectWs(url);
      });

      this.ws.addEventListener("error", (e) => {
        console.error("[MiStream] error.", e);
      });

      this.ws.addEventListener("message", async (e) => {
        console.log(e.data);

        const data: StreamMessageMap[keyof StreamMessageMap] = JSON.parse(
          e.data,
        );

        this.dispatchEvent(
          new MiStreamEvent(
            data.body.type,
            data.body,
          ),
        );
      });
    });
  }

  connectTimeline(name: "homeTimeline", option?: { withReplies: boolean }) {
    let params;
    if (name == "homeTimeline") {
      params = {
        withReplies: option?.withReplies || false,
      };
    }

    this.ws?.send(JSON.stringify({
      type: "connect",
      body: {
        channel: name,
        id: `timeline-${name}`,
        params,
      },
    }));
  }

  connectMain() {
    this.ws?.send(JSON.stringify({
      type: "connect",
      body: {
        channel: "main",
        id: "main",
      },
    }));
  }

  addEventListener<K extends keyof StreamMessageMap>(
    type: K,
    listener: (this: this, e: MiStreamEvent<K>) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.eventTarget.addEventListener(type, listener as any, options);
  }

  dispatchEvent<K extends keyof StreamMessageMap>(
    e: MiStreamEvent<K>,
  ): boolean {
    return this.eventTarget.dispatchEvent(e);
  }

  removeEventListener<K extends keyof StreamMessageMap>(
    type: K,
    listener: (this: this, e: MiStreamEvent<K>) => void,
    options?: EventListenerOptions | boolean,
  ): void {
    this.eventTarget.removeEventListener(type, listener as any, options);
  }
}
