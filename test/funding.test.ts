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
