import type { DB } from "./db.js";

export function recordClaim(
  db: DB,
  c: { address: string; ip: string; amount: number; txid: string; at: number }
): void {
  db.prepare(
    "INSERT INTO claims(address, ip, amount, txid, created_at) VALUES(?,?,?,?,?)"
  ).run(c.address, c.ip, c.amount, c.txid, c.at);
}

export function lastClaimAt(db: DB, address: string, ip: string): number | null {
  const row = db
    .prepare("SELECT MAX(created_at) AS m FROM claims WHERE address = ? OR ip = ?")
    .get(address, ip) as { m: number | null };
  return row.m ?? null;
}

export function canClaim(
  db: DB,
  address: string,
  ip: string,
  now: number,
  cooldownSeconds: number
): boolean {
  const last = lastClaimAt(db, address, ip);
  return last === null || now - last >= cooldownSeconds;
}

export function totalDistributed(db: DB): number {
  const row = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM claims").get() as { s: number };
  return row.s;
}

export function claimsSince(db: DB, sinceEpoch: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM claims WHERE created_at >= ?")
    .get(sinceEpoch) as { c: number };
  return row.c;
}
