import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export type DB = Database.Database;

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      ip TEXT NOT NULL,
      amount INTEGER NOT NULL,
      txid TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_claims_address ON claims(address);
    CREATE INDEX IF NOT EXISTS idx_claims_ip ON claims(ip);
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_nicks INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  return db;
}

export function kvGet(db: DB, key: string): string | null {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as
    | { value: string } | undefined;
  return row ? row.value : null;
}

export function kvSet(db: DB, key: string, value: string): void {
  db.prepare(
    "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}
