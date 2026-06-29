import { expect, test } from "vitest";
import { fundingStatus } from "../src/funding.js";

test("computes covered usd and capped percent", () => {
  const s = fundingStatus({
    monthlyDonationNicks: 65536 * 21, // 21 NOCK
    nicksPerNock: 65536,
    priceUsd: 0.2,
    monthlyCostUsd: 6,
  });
  expect(s.coveredUsd).toBe(4.2);
  expect(s.percent).toBe(70);
});

test("percent caps at 100", () => {
  const s = fundingStatus({
    monthlyDonationNicks: 65536 * 1000,
    nicksPerNock: 65536,
    priceUsd: 1,
    monthlyCostUsd: 6,
  });
  expect(s.percent).toBe(100);
});

test("zero donations gives an empty bar", () => {
  const s = fundingStatus({ monthlyDonationNicks: 0, nicksPerNock: 65536, priceUsd: 0.2, monthlyCostUsd: 6 });
  expect(s.coveredUsd).toBe(0);
  expect(s.percent).toBe(0);
});

test("over-funding caps percent but reports the real covered amount", () => {
  const s = fundingStatus({ monthlyDonationNicks: 65536 * 60, nicksPerNock: 65536, priceUsd: 0.2, monthlyCostUsd: 6 });
  expect(s.coveredUsd).toBe(12); // 60 NOCK * $0.2 = $12, over the $6 cost
  expect(s.percent).toBe(100);
});

test("clamps percent to a zero floor", () => {
  const s = fundingStatus({ monthlyDonationNicks: -100, nicksPerNock: 65536, priceUsd: 0.2, monthlyCostUsd: 6 });
  expect(s.percent).toBe(0);
});
