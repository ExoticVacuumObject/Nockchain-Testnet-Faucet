import { expect, test } from "vitest";
import { openDb, kvGet, kvSet } from "../src/db.js";

test("schema + kv round trip", () => {
  const db = openDb(":memory:");
  expect(kvGet(db, "x")).toBeNull();
  kvSet(db, "x", "42");
  expect(kvGet(db, "x")).toBe("42");
  const cols = db.prepare("PRAGMA table_info(claims)").all() as { name: string }[];
  expect(cols.map(c => c.name)).toContain("created_at");
});
