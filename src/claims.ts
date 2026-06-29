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

// Atomically re-check the cooldown and insert a pending row (empty txid). Because
// better-sqlite3 transactions run synchronously, two concurrent callers cannot both
// pass the check before reserving — this closes the double-claim race. Returns the
// new row id, or null if the cooldown blocks.
export function reserveClaim(
  db: DB,
  address: string,
  ip: string,
  now: number,
  cooldownSeconds: number,
  amount: number
): number | null {
  return db.transaction((): number | null => {
    if (!canClaim(db, address, ip, now, cooldownSeconds)) return null;
    const info = db
      .prepare("INSERT INTO claims(address, ip, amount, txid, created_at) VALUES(?,?,?,?,?)")
      .run(address, ip, amount, "", now);
    return Number(info.lastInsertRowid);
  })();
}

export function finalizeClaim(db: DB, id: number, txid: string): void {
  db.prepare("UPDATE claims SET txid = ? WHERE id = ?").run(txid, id);
}

export function releaseClaim(db: DB, id: number): void {
  db.prepare("DELETE FROM claims WHERE id = ?").run(id);
}

export function totalDistributed(db: DB): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM claims WHERE txid != ''")
    .get() as { s: number };
  return row.s;
}

export function claimsSince(db: DB, sinceEpoch: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM claims WHERE created_at >= ?")
    .get(sinceEpoch) as { c: number };
  return row.c;
}
