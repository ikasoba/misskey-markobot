import { MiUser } from "./User.ts";

export interface MiNote {
  id: string;
  text?: string | null;
  user: MiUser;
  userId: string;
  channelId?: string | null;
  reactions: Record<string, number>;
  createdAt: string;
}
