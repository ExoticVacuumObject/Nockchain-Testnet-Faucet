import { expect, test } from "vitest";
import { openDb } from "../src/db.js";
import { recordClaim, lastClaimAt, canClaim, totalDistributed, claimsSince, reserveClaim, clearPendingClaims } from "../src/claims.js";

const DAY = 86400;

test("cooldown blocks repeat address and IP within window", () => {
  const db = openDb(":memory:");
  const now = 1_000_000;
  expect(canClaim(db, "addrA", "1.1.1.1", now, DAY)).toBe(true);
  recordClaim(db, { address: "addrA", ip: "1.1.1.1", amount: 1000, txid: "t1", at: now });
  expect(canClaim(db, "addrA", "9.9.9.9", now + 10, DAY)).toBe(false); // same address
  expect(canClaim(db, "addrB", "1.1.1.1", now + 10, DAY)).toBe(false); // same IP
  expect(canClaim(db, "addrA", "1.1.1.1", now + DAY + 1, DAY)).toBe(true); // window passed
  expect(lastClaimAt(db, "addrA", "2.2.2.2")).toBe(now);
});

test("cooldown allows at exactly the window boundary", () => {
  const db = openDb(":memory:");
  const now = 1_000_000;
  recordClaim(db, { address: "addrA", ip: "1.1.1.1", amount: 1000, txid: "t1", at: now });
  expect(canClaim(db, "addrA", "1.1.1.1", now + DAY - 1, DAY)).toBe(false); // one second short
  expect(canClaim(db, "addrA", "1.1.1.1", now + DAY, DAY)).toBe(true); // exactly elapsed
});

test("aggregates", () => {
  const db = openDb(":memory:");
  recordClaim(db, { address: "a", ip: "i", amount: 1000, txid: "t", at: 100 });
  recordClaim(db, { address: "b", ip: "j", amount: 1000, txid: "t", at: 200 });
  expect(totalDistributed(db)).toBe(2000);
  expect(claimsSince(db, 150)).toBe(1);
});

test("clearPendingClaims removes only un-finalized rows and frees their slots", () => {
  const db = openDb(":memory:");
  recordClaim(db, { address: "done", ip: "i1", amount: 1000, txid: "t1", at: 100 });
  reserveClaim(db, "pending", "i2", 200, 86400, 1000); // orphaned reserve (txid='')
  expect(canClaim(db, "pending", "i2", 250, 86400)).toBe(false); // blocked while pending
  clearPendingClaims(db);
  expect(canClaim(db, "pending", "i2", 250, 86400)).toBe(true); // slot freed
  expect(totalDistributed(db)).toBe(1000); // finalized row untouched
});
