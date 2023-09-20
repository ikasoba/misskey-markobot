import { MiUser } from "./User.ts";

export interface MiNote {
  id: string;
  text?: string | null;
  user: MiUser;
  userId: string;
}
