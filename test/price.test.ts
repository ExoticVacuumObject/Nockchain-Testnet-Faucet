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
