import { Database } from "sqlite3/mod.ts";

export interface TokenInfo {
  [next: string]: number;
}

export type TokenTable = [name: string, info: string];

export class TokenStorage {
  constructor(private db: Database) {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS tokens (name TEXT PRIMARY KEY, info BLOB)",
    );
  }

  get(
    name: string,
  ): TokenInfo | null {
    const row = this.db.prepare(
      "SELECT * FROM tokens WHERE name = ? LIMIT 1",
    )
      .value<TokenTable>(name);

    if (!row) {
      return null;
    } else {
      return JSON.parse(row[1]);
    }
  }

  set(
    name: string,
    value: TokenInfo,
  ): void {
    this.db.prepare(
      "INSERT INTO tokens VALUES (:k, :v) ON CONFLICT (name) DO UPDATE SET name = :k, info = :v",
    ).value<TokenTable>({ k: name, v: JSON.stringify(value) });
  }
}
