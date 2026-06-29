import { expect, test } from "vitest";
import { openDb } from "../src/db.js";
import { applyBalanceSnapshot, monthlyDonationNicks, monthStartEpoch } from "../src/donations.js";

function donationRows(db: ReturnType<typeof openDb>): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM donations").get() as { c: number }).c;
}

test("seeds baseline then records positive deltas only", () => {
  const db = openDb(":memory:");
  expect(applyBalanceSnapshot(db, 1000, 100)).toBe(0);    // first snapshot seeds baseline, no donation
  expect(donationRows(db)).toBe(0);
  expect(applyBalanceSnapshot(db, 1500, 200)).toBe(500);  // +500
  expect(applyBalanceSnapshot(db, 1500, 300)).toBe(0);    // no change
  expect(applyBalanceSnapshot(db, 1200, 400)).toBe(0);    // spend, ignored
  expect(applyBalanceSnapshot(db, 1700, 500)).toBe(500);  // +500 again
  expect(donationRows(db)).toBe(2);
});

test("baseline of zero is distinct from no baseline", () => {
  const db = openDb(":memory:");
  expect(applyBalanceSnapshot(db, 0, 100)).toBe(0); // seeds baseline at 0, no donation
  expect(donationRows(db)).toBe(0);
  expect(applyBalanceSnapshot(db, 300, 200)).toBe(300); // +300 from the zero baseline
  expect(donationRows(db)).toBe(1);
});

test("a non-finite read is ignored and does not corrupt the baseline", () => {
  const db = openDb(":memory:");
  applyBalanceSnapshot(db, 1000, 100); // baseline 1000
  expect(applyBalanceSnapshot(db, NaN, 200)).toBe(0); // bad read
  expect(donationRows(db)).toBe(0);
  expect(applyBalanceSnapshot(db, 1500, 300)).toBe(500); // baseline survived: +500 from 1000
  expect(donationRows(db)).toBe(1);
});

test("a negative read is ignored and does not corrupt the baseline", () => {
  const db = openDb(":memory:");
  applyBalanceSnapshot(db, 1000, 100); // baseline 1000
  expect(applyBalanceSnapshot(db, -5, 200)).toBe(0); // impossible balance
  expect(donationRows(db)).toBe(0);
  expect(applyBalanceSnapshot(db, 1500, 300)).toBe(500); // baseline survived
});

test("monthly sum filters by month start", () => {
  const db = openDb(":memory:");
  applyBalanceSnapshot(db, 100, 10);
  const ms = monthStartEpoch(1_700_000_000);
  applyBalanceSnapshot(db, 200, ms + 5);
  expect(monthlyDonationNicks(db, ms)).toBe(100);
});

test("monthStartEpoch is UTC midnight on the 1st", () => {
  const d = new Date("2026-06-15T12:34:00Z").getTime() / 1000;
  const ms = monthStartEpoch(d);
  expect(new Date(ms * 1000).toISOString()).toBe("2026-06-01T00:00:00.000Z");
});
