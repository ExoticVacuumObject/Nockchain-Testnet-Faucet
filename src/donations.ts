import type { DB } from "./db.js";
import { kvGet, kvSet } from "./db.js";

const LAST_BALANCE_KEY = "donate_balance";

export function applyBalanceSnapshot(db: DB, currentNicks: number, at: number): number {
  const stored = kvGet(db, LAST_BALANCE_KEY);
  if (stored === null) {
    kvSet(db, LAST_BALANCE_KEY, String(currentNicks));
    return 0; // first snapshot seeds the baseline; pre-existing balance is not a donation
  }
  const delta = currentNicks - Number(stored);
  if (delta > 0) {
    db.prepare("INSERT INTO donations(amount_nicks, recorded_at) VALUES(?,?)").run(delta, at);
  }
  kvSet(db, LAST_BALANCE_KEY, String(currentNicks));
  return delta > 0 ? delta : 0;
}

export function monthlyDonationNicks(db: DB, monthStartEpoch: number): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(amount_nicks),0) AS s FROM donations WHERE recorded_at >= ?")
    .get(monthStartEpoch) as { s: number };
  return row.s;
}

export function monthStartEpoch(now: number): number {
  const d = new Date(now * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}
