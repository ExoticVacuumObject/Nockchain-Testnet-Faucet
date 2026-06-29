import { expect, test } from "vitest";
import { loadConfig } from "../src/config.js";

const base = {
  PORT: "4500", CLAIM_AMOUNT: "1000", COOLDOWN_HOURS: "24",
  TREASURY_FLOOR: "500000", TREASURY_CEIL: "1000000",
  DONATE_ADDRESS: "9Wz", MONTHLY_COST_USD: "6", NICKS_PER_NOCK: "65536",
  DB_PATH: "./faucet.db", FAUCET_PKH: "pkh1", BALANCE_API_URL: "http://x",
  PRICE_URL: "http://p", WALLET_BIN: "nockchain-wallet", NODE_SOCKET: "./n.sock",
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
