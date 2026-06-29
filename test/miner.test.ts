import { expect, test, vi } from "vitest";
import { shouldMine, makeMiner, type Spawner } from "../src/miner.js";

test("mines only below floor", () => {
  expect(shouldMine(499_999 * 65536, 500_000 * 65536)).toBe(true);
  expect(shouldMine(500_000 * 65536, 500_000 * 65536)).toBe(false);
  expect(shouldMine(900_000 * 65536, 500_000 * 65536)).toBe(false);
});

const inertSpawner: Spawner = () => ({ kill: () => {}, on: () => {} });

function miner(spawner: Spawner, opts: { maxMineMs?: number; now?: () => number } = {}) {
  return makeMiner({
    minerBin: "x", minerArgs: [], cwd: ".", pollMs: 1,
    maxMineMs: opts.maxMineMs ?? 100_000, spawner, now: opts.now,
  });
}

test("returns once the balance reaches the target", async () => {
  let calls = 0;
  const m = miner(inertSpawner);
  await expect(m.mineUntil(1000, async () => (++calls >= 2 ? 1000 : 0))).resolves.toBeUndefined();
});

test("throws after the max duration if the target is never reached", async () => {
  let t = 0;
  const m = miner(inertSpawner, { maxMineMs: 100, now: () => t });
  await expect(
    m.mineUntil(1000, async () => {
      t += 50; // advance the clock past maxMineMs
      return 0;
    })
  ).rejects.toThrow(/timed out/);
});

test("throws if the miner process exits before the target", async () => {
  let onExit: () => void = () => {};
  const spawner: Spawner = () => ({ kill: () => {}, on: (e, cb) => { if (e === "exit") onExit = cb; } });
  const m = miner(spawner);
  await expect(
    m.mineUntil(1000, async () => { onExit(); return 0; })
  ).rejects.toThrow(/exited/);
});

test("throws if the spawn errors", async () => {
  let onError: (err: unknown) => void = () => {};
  const spawner: Spawner = () => ({ kill: () => {}, on: (e, cb) => { if (e === "error") onError = cb; } });
  const m = miner(spawner);
  await expect(
    m.mineUntil(1000, async () => { onError(new Error("ENOENT")); return 0; })
  ).rejects.toThrow(/ENOENT/);
});

test("kills the process when mining finishes", async () => {
  const kill = vi.fn();
  const spawner: Spawner = () => ({ kill, on: () => {} });
  const m = miner(spawner);
  await m.mineUntil(1000, async () => 1000);
  expect(kill).toHaveBeenCalledTimes(1);
});
