import { expect, test } from "vitest";
import { shouldMine } from "../src/miner.js";

test("mines only below floor", () => {
  expect(shouldMine(499_999 * 65536, 500_000 * 65536)).toBe(true);
  expect(shouldMine(500_000 * 65536, 500_000 * 65536)).toBe(false);
  expect(shouldMine(900_000 * 65536, 500_000 * 65536)).toBe(false);
});
