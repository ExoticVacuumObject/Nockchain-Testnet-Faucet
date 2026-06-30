import type { DB } from "./db.js";
import { kvGet, kvSet } from "./db.js";

const LAST_BALANCE_KEY = "donate_balance";

export function applyBalanceSnapshot(db: DB, currentNicks: number, at: number): number {
  if (!Number.isFinite(currentNicks) || currentNicks < 0) return 0; // ignore bad reads; never touch the baseline
  const stored = kvGet(db, LAST_BALANCE_KEY);
  if (stored === null) {
    kvSet(db, LAST_BALANCE_KEY, String(currentNicks));
    return 0; // first snapshot seeds the baseline; pre-existing balance is not a donation
  }
  const delta = currentNicks - Number(stored);
  // Only ever raise the baseline (high-water mark). Lowering it on a dip would make a
  // later recovery look like a fresh donation. Deltas are recorded only above the peak,
  // so the bar under-counts after a real withdrawal rather than inventing phantoms.
  if (delta > 0) {
    db.transaction(() => {
      db.prepare("INSERT INTO donations(amount_nicks, recorded_at) VALUES(?,?)").run(delta, at);
      kvSet(db, LAST_BALANCE_KEY, String(currentNicks));
    })();
  }
  return delta > 0 ? delta : 0;
}

export function monthlyDonationNicks(db: DB, monthStartEpoch: number): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(amount_nicks),0) AS s FROM donations WHERE recorded_at >= ?")
    .get(monthStartEpoch) as { s: number };
  return row.s;
}

// Validate a balance-api response before trusting it. Returns the balance in nicks,
// or null if the response should be skipped (bad status/shape/balance/height). Guards
// the phantom-donation case where a transient bad read would register a giant delta.
export function balanceFromResponse(ok: boolean, body: unknown): number | null {
  if (!ok || typeof body !== "object" || body === null) return null;
  const b = body as { balance?: unknown; height?: unknown };
  if (typeof b.balance !== "number" || !Number.isFinite(b.balance) || b.balance < 0) return null;
  if (b.height !== undefined && (typeof b.height !== "number" || !(b.height > 0))) return null;
  return b.balance;
}

export function monthStartEpoch(now: number): number {
  const d = new Date(now * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}
