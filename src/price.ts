export interface PriceCache {
  get(): Promise<number>;
}

export function makePriceCache(opts: {
  url: string;
  ttlMs: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): PriceCache {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => Date.now());
  const timeoutMs = opts.timeoutMs ?? 5000;
  let value: number | null = null;
  let fetchedAt = -Infinity;
  let inflight: Promise<number> | null = null;

  async function refresh(): Promise<number> {
    try {
      const res = await fetchImpl(opts.url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`price http ${res.status}`);
      const body = (await res.json()) as { usd?: unknown };
      const usd = body?.usd;
      if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
        throw new Error("invalid price payload");
      }
      value = usd;
      fetchedAt = now();
      return usd;
    } catch (err) {
      if (value !== null) return value;
      throw err;
    }
  }

  return {
    async get(): Promise<number> {
      if (value !== null && now() - fetchedAt < opts.ttlMs) return value;
      if (!inflight) inflight = refresh().finally(() => { inflight = null; });
      return inflight;
    },
  };
}
