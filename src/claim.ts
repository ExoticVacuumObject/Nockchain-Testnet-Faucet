import type { DB } from "./db.js";
import type { Wallet } from "./wallet.js";
import { isValidAddress } from "./address.js";
import { reserveClaim, finalizeClaim, releaseClaim, lastClaimAt } from "./claims.js";

export type ClaimResult =
  | { ok: true; txid: string }
  | { ok: false; error: "invalid_address" | "cooldown" | "send_failed"; retryAfter?: number };

export async function handleClaim(
  deps: { db: DB; wallet: Wallet; claimAmount: number; cooldownSeconds: number; now: () => number },
  input: { address: string; ip: string }
): Promise<ClaimResult> {
  const now = deps.now();
  if (!isValidAddress(input.address)) return { ok: false, error: "invalid_address" };

  const id = reserveClaim(deps.db, input.address, input.ip, now, deps.cooldownSeconds, deps.claimAmount);
  if (id === null) {
    const last = lastClaimAt(deps.db, input.address, input.ip) ?? now;
    return { ok: false, error: "cooldown", retryAfter: deps.cooldownSeconds - (now - last) };
  }

  let txid: string;
  try {
    txid = await deps.wallet.send(input.address, deps.claimAmount);
  } catch (err) {
    // Free the slot so the user can retry. Duplicate fakenet tokens are harmless,
    // and an outage should not lock people out for the full cooldown.
    releaseClaim(deps.db, id);
    console.error(`claim send failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, error: "send_failed" };
  }
  finalizeClaim(deps.db, id, txid);
  return { ok: true, txid };
}
