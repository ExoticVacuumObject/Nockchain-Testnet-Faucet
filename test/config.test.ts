import { expect, test } from "vitest";
import { loadConfig } from "../src/config.js";

const base = {
  PORT: "4500", CLAIM_AMOUNT: "1000", COOLDOWN_HOURS: "24",
  TREASURY_FLOOR: "500000", TREASURY_CEIL: "1000000",
  DONATE_ADDRESS: "9Wz", MONTHLY_COST_USD: "6", NICKS_PER_NOCK: "65536",
  DB_PATH: "./faucet.db", FAUCET_PKH: "pkh1", BALANCE_API_URL: "http://x",
  PRICE_URL: "http://p", WALLET_BIN: "nockchain-wallet", WALLET_GRPC_PORT: "5556",
  TREASURY_POLL_MS: "60000", DONATION_POLL_MS: "300000",
};

test("parses numbers and strings", () => {
  const c = loadConfig(base as any);
  expect(c.port).toBe(4500);
  expect(c.claimAmount).toBe(1000);
  expect(c.donateAddress).toBe("9Wz");
  expect(c.nicksPerNock).toBe(65536);
});

test("throws on missing required field", () => {
  const { DONATE_ADDRESS, ...rest } = base as any;
  expect(() => loadConfig(rest)).toThrow(/DONATE_ADDRESS/);
});

test("throws on whitespace-only number", () => {
  expect(() => loadConfig({ ...base, PORT: "   " } as any)).toThrow(/PORT/);
});

test("throws when treasury floor is not below ceil", () => {
  expect(() =>
    loadConfig({ ...base, TREASURY_FLOOR: "1000000", TREASURY_CEIL: "1000000" } as any)
  ).toThrow(/TREASURY_FLOOR/);
});

test("throws on non-positive claim amount", () => {
  expect(() => loadConfig({ ...base, CLAIM_AMOUNT: "0" } as any)).toThrow(/CLAIM_AMOUNT/);
});

test("throws on zero monthly cost", () => {
  expect(() => loadConfig({ ...base, MONTHLY_COST_USD: "0" } as any)).toThrow(/MONTHLY_COST_USD/);
});

test("throws on zero nicks per nock", () => {
  expect(() => loadConfig({ ...base, NICKS_PER_NOCK: "0" } as any)).toThrow(/NICKS_PER_NOCK/);
});

test("throws on zero cooldown (would disable the only rate limit)", () => {
  expect(() => loadConfig({ ...base, COOLDOWN_HOURS: "0" } as any)).toThrow(/COOLDOWN_HOURS/);
});

test("throws on non-positive poll intervals (would busy-loop)", () => {
  expect(() => loadConfig({ ...base, TREASURY_POLL_MS: "0" } as any)).toThrow(/TREASURY_POLL_MS/);
  expect(() => loadConfig({ ...base, DONATION_POLL_MS: "-1" } as any)).toThrow(/DONATION_POLL_MS/);
});
