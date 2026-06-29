export interface PriceCache {
  get(): Promise<number>;
}

export function makePriceCache(opts: {
  url: string;
  ttlMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): PriceCache {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => Date.now());
  let value: number | null = null;
  let fetchedAt = -Infinity;

  return {
    async get(): Promise<number> {
      if (value !== null && now() - fetchedAt < opts.ttlMs) return value;
      try {
        const res = await fetchImpl(opts.url);
        if (!res.ok) throw new Error(`price http ${res.status}`);
        const body = (await res.json()) as { usd: number };
        value = body.usd;
        fetchedAt = now();
        return value;
      } catch (err) {
        if (value !== null) return value;
        throw err;
      }
    },
  };
}
