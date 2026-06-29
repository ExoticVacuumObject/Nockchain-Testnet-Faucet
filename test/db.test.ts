import { expect, test } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, kvGet, kvSet } from "../src/db.js";

function cols(db: ReturnType<typeof openDb>, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
}

test("schema + kv round trip", () => {
  const db = openDb(":memory:");
  expect(kvGet(db, "x")).toBeNull();
  kvSet(db, "x", "42");
  expect(kvGet(db, "x")).toBe("42");
  expect(cols(db, "claims")).toContain("created_at");
});

test("creates donations table with expected columns", () => {
  const db = openDb(":memory:");
  expect(cols(db, "donations")).toEqual(
    expect.arrayContaining(["id", "amount_nicks", "recorded_at"])
  );
});

test("creates parent directories for a nested db path", () => {
  const dir = mkdtempSync(join(tmpdir(), "nockfaucet-"));
  const nested = join(dir, "nested", "deeper", "faucet.db");
  const db = openDb(nested);
  expect(existsSync(nested)).toBe(true);
  db.close();
});
