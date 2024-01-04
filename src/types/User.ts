export interface MiUser {
  id: string;
  /** 表示名 */
  name?: string | null;
  username: string;
  host?: string | null;
  avatarUrl?: string | null;
}
