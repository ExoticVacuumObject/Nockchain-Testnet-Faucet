import { expect, test, vi } from "vitest";
import { openDb } from "../src/db.js";
import { handleClaim } from "../src/claim.js";
import { totalDistributed } from "../src/claims.js";

const VALID = "9WzHyhnanLweqrPJe3KzKNsU8srmzjkXE2oiKZpV1BecK3XuPXS3Ges";

function deps(db: any, wallet: any, now = 1000) {
  return { db, wallet, claimAmount: 1000, cooldownSeconds: 86400, now: () => now };
}

test("rejects invalid address", async () => {
  const db = openDb(":memory:");
  const r = await handleClaim(deps(db, { send: vi.fn() }), { address: "bad", ip: "i" });
  expect(r).toEqual({ ok: false, error: "invalid_address" });
});

test("happy path sends, finalizes, and counts as distributed", async () => {
  const db = openDb(":memory:");
  const wallet = { send: vi.fn(async () => "tx1"), treasuryNicks: vi.fn() };
  const r = await handleClaim(deps(db, wallet), { address: VALID, ip: "1.1.1.1" });
  expect(r).toEqual({ ok: true, txid: "tx1" });
  expect(wallet.send).toHaveBeenCalledWith(VALID, 1000);
  expect(totalDistributed(db)).toBe(1000);
});

test("second claim within cooldown is blocked with retryAfter", async () => {
  const db = openDb(":memory:");
  const wallet = { send: vi.fn(async () => "tx1"), treasuryNicks: vi.fn() };
  await handleClaim(deps(db, wallet, 1000), { address: VALID, ip: "1.1.1.1" });
  const r = await handleClaim(deps(db, wallet, 2000), { address: VALID, ip: "1.1.1.1" });
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.error).toBe("cooldown");
    expect(r.retryAfter).toBe(85400);
  }
});

test("a failed send releases the slot and is not counted", async () => {
  const db = openDb(":memory:");
  const failing = { send: vi.fn(async () => { throw new Error("boom"); }), treasuryNicks: vi.fn() };
  const r = await handleClaim(deps(db, failing), { address: VALID, ip: "1.1.1.1" });
  expect(r).toEqual({ ok: false, error: "send_failed" });
  expect(totalDistributed(db)).toBe(0); // reserved row was released
  // a retry is not blocked, since the failed attempt freed the slot
  const ok = { send: vi.fn(async () => "tx2"), treasuryNicks: vi.fn() };
  const r2 = await handleClaim(deps(db, ok), { address: VALID, ip: "1.1.1.1" });
  expect(r2.ok).toBe(true);
});

test("two concurrent claims for one address yield exactly one success", async () => {
  const db = openDb(":memory:");
  const wallet = { send: vi.fn(async () => "tx"), treasuryNicks: vi.fn() };
  const d = deps(db, wallet);
  const results = await Promise.all([
    handleClaim(d, { address: VALID, ip: "1.1.1.1" }),
    handleClaim(d, { address: VALID, ip: "1.1.1.1" }),
  ]);
  expect(results.filter((r) => r.ok).length).toBe(1);
  expect(wallet.send).toHaveBeenCalledTimes(1);
});
