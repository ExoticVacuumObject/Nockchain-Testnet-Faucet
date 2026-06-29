import { expect, test, vi } from "vitest";
import { makePriceCache } from "../src/price.js";

function fakeFetch(value: number) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ usd: value }) }) as any);
}

test("caches within ttl and refreshes after", async () => {
  let t = 0;
  const f = fakeFetch(2);
  const cache = makePriceCache({ url: "http://p", ttlMs: 1000, fetchImpl: f, now: () => t });
  expect(await cache.get()).toBe(2);
  expect(await cache.get()).toBe(2);
  expect(f).toHaveBeenCalledTimes(1);
  t = 2000;
  await cache.get();
  expect(f).toHaveBeenCalledTimes(2);
});

test("falls back to last good value on error", async () => {
  let t = 0;
  const f = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ usd: 3 }) } as any)
    .mockRejectedValueOnce(new Error("down"));
  const cache = makePriceCache({ url: "http://p", ttlMs: 0, fetchImpl: f as any, now: () => t });
  expect(await cache.get()).toBe(3);
  t = 10;
  expect(await cache.get()).toBe(3); // fetch failed, returns last good
});

test("rejects an invalid payload and falls back to last good", async () => {
  let t = 0;
  const f = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ usd: 5 }) } as any)
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as any) // no usd field
    .mockResolvedValueOnce({ ok: true, json: async () => ({ usd: 0 }) } as any); // non-positive
  const cache = makePriceCache({ url: "http://p", ttlMs: 0, fetchImpl: f as any, now: () => t });
  expect(await cache.get()).toBe(5);
  expect(await cache.get()).toBe(5); // malformed -> last good, not undefined
  expect(await cache.get()).toBe(5); // zero price -> last good
});

test("throws when the first payload is invalid (no prior good value)", async () => {
  const f = vi.fn(async () => ({ ok: true, json: async () => ({ usd: "oops" }) }) as any);
  const cache = makePriceCache({ url: "http://p", ttlMs: 0, fetchImpl: f, now: () => 0 });
  await expect(cache.get()).rejects.toThrow();
});
