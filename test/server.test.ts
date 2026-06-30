import { expect, test, vi } from "vitest";
import { openDb } from "../src/db.js";
import { buildServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";

const VALID = "9WzHyhnanLweqrPJe3KzKNsU8srmzjkXE2oiKZpV1BecK3XuPXS3Ges";
const env = {
  PORT: "4500", CLAIM_AMOUNT: "1000", COOLDOWN_HOURS: "24",
  TREASURY_FLOOR: "500000", TREASURY_CEIL: "1000000",
  DONATE_ADDRESS: VALID, MONTHLY_COST_USD: "6", NICKS_PER_NOCK: "65536",
  DB_PATH: ":memory:", FAUCET_PKH: "pk", BALANCE_API_URL: "http://x",
  PRICE_URL: "http://p", WALLET_BIN: "nw", WALLET_GRPC_PORT: "5556",
  TREASURY_POLL_MS: "1000", DONATION_POLL_MS: "1000",
};

function make() {
  const db = openDb(":memory:");
  const wallet = { send: vi.fn(async () => "tx1"), treasuryNicks: vi.fn(), watchAddress: vi.fn() };
  const price = { get: vi.fn(async () => 0.2) };
  return buildServer({
    db, wallet, price, config: loadConfig(env as any),
    treasuryNicks: () => 832500 * 65536, now: () => 1000,
  });
}

test("claim happy path returns txid", async () => {
  const app = make();
  const res = await app.inject({ method: "POST", url: "/api/claim", payload: { address: VALID } });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ txid: "tx1" });
});

test("invalid address returns 400", async () => {
  const app = make();
  const res = await app.inject({ method: "POST", url: "/api/claim", payload: { address: "bad" } });
  expect(res.statusCode).toBe(400);
});

test("non-string address returns 400, not 500", async () => {
  const app = make();
  const res = await app.inject({ method: "POST", url: "/api/claim", payload: { address: 123 } });
  expect(res.statusCode).toBe(400);
});

test("second claim from same address returns 429 with retryAfter", async () => {
  const app = make();
  await app.inject({ method: "POST", url: "/api/claim", payload: { address: VALID } });
  const res = await app.inject({ method: "POST", url: "/api/claim", payload: { address: VALID } });
  expect(res.statusCode).toBe(429);
  expect(res.json().retryAfter).toBeGreaterThan(0);
});

test("stats reports the cached treasury without calling the wallet", async () => {
  const db = openDb(":memory:");
  const wallet = { send: vi.fn(), treasuryNicks: vi.fn(), watchAddress: vi.fn() };
  const price = { get: vi.fn(async () => 0.2) };
  const app = buildServer({
    db, wallet, price, config: loadConfig(env as any),
    treasuryNicks: () => 832500 * 65536, now: () => 1000,
  });
  const res = await app.inject({ method: "GET", url: "/api/stats" });
  expect(res.json().treasuryNock).toBe(832500);
  expect(wallet.treasuryNicks).not.toHaveBeenCalled();
});

test("an unexpected route error returns a generic 500 with no internal detail", async () => {
  const db = openDb(":memory:");
  const wallet = { send: vi.fn(async () => "tx1"), treasuryNicks: vi.fn(), watchAddress: vi.fn() };
  const price = { get: vi.fn(async () => 0.2) };
  const app = buildServer({
    db, wallet, price, config: loadConfig(env as any),
    treasuryNicks: () => 0, now: () => 1000,
  });
  db.close(); // force the claim path's DB query to throw
  const res = await app.inject({ method: "POST", url: "/api/claim", payload: { address: VALID } });
  expect(res.statusCode).toBe(500);
  expect(res.json()).toEqual({ error: "internal error" });
  expect(res.payload).not.toMatch(/database|sqlite|prepare|\.ts/i);
});

test("funding reports the configured cost and donate address", async () => {
  const app = make();
  const res = await app.inject({ method: "GET", url: "/api/funding" });
  expect(res.json().monthlyCostUsd).toBe(6);
  expect(res.json().donateAddress).toBe(VALID);
});
