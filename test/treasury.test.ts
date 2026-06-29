import { expect, test, vi } from "vitest";
import { startTreasuryWatcher } from "../src/treasury.js";

const NPN = 65536;

test("reads the treasury immediately on start", async () => {
  const wallet = { send: vi.fn(), treasuryNicks: vi.fn(async () => 900_000 * NPN) };
  const miner = { mineUntil: vi.fn(), stop: vi.fn() };
  const w = startTreasuryWatcher({
    wallet: wallet as any, miner: miner as any,
    floorNicks: 500_000 * NPN, ceilNicks: 1_000_000 * NPN, intervalMs: 100_000,
  });
  await new Promise((r) => setTimeout(r, 10)); // let the immediate tick run
  expect(w.lastNicks()).toBe(900_000 * NPN);
  expect(miner.mineUntil).not.toHaveBeenCalled(); // above floor, no mining
  w.stop();
});

test("mines on start when below floor", async () => {
  const wallet = { send: vi.fn(), treasuryNicks: vi.fn(async () => 400_000 * NPN) };
  const miner = { mineUntil: vi.fn(async () => {}), stop: vi.fn() };
  const w = startTreasuryWatcher({
    wallet: wallet as any, miner: miner as any,
    floorNicks: 500_000 * NPN, ceilNicks: 1_000_000 * NPN, intervalMs: 100_000,
  });
  await new Promise((r) => setTimeout(r, 10));
  expect(miner.mineUntil).toHaveBeenCalledTimes(1);
  w.stop();
});
