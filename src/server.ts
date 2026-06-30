import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { DB } from "./db.js";
import type { Wallet } from "./wallet.js";
import type { PriceCache } from "./price.js";
import type { Config } from "./config.js";
import { handleClaim } from "./claim.js";
import { totalDistributed, claimsSince } from "./claims.js";
import { monthlyDonationNicks, monthStartEpoch } from "./donations.js";
import { fundingStatus } from "./funding.js";
import { normalizeIp } from "./ip.js";

const here = dirname(fileURLToPath(import.meta.url));

export function buildServer(deps: {
  db: DB;
  wallet: Wallet;
  price: PriceCache;
  config: Config;
  treasuryNicks: () => number;
  now?: () => number;
}): FastifyInstance {
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  // Trust X-Forwarded-For only from the local reverse proxy, never a direct client.
  const app = Fastify({ trustProxy: "loopback" });

  app.register(fastifyStatic, { root: join(here, "..", "public"), prefix: "/" });

  app.post("/api/claim", async (req, reply) => {
    const raw = (req.body as { address?: unknown } | undefined)?.address;
    const address = typeof raw === "string" ? raw.trim() : "";
    const r = await handleClaim(
      {
        db: deps.db,
        wallet: deps.wallet,
        claimAmount: deps.config.claimAmount,
        cooldownSeconds: deps.config.cooldownHours * 3600,
        now,
      },
      { address, ip: normalizeIp(req.ip) }
    );
    if (r.ok) return reply.send({ txid: r.txid });
    if (r.error === "invalid_address") return reply.code(400).send({ error: r.error });
    if (r.error === "cooldown") return reply.code(429).send({ error: r.error, retryAfter: r.retryAfter });
    return reply.code(503).send({ error: r.error });
  });

  app.get("/api/stats", async () => ({
    distributed: totalDistributed(deps.db),
    treasuryNock: Math.floor(deps.treasuryNicks() / deps.config.nicksPerNock),
    claims24h: claimsSince(deps.db, now() - 86400),
  }));

  app.get("/api/funding", async () => {
    const priceUsd = await deps.price.get().catch(() => 0);
    return {
      ...fundingStatus({
        monthlyDonationNicks: monthlyDonationNicks(deps.db, monthStartEpoch(now())),
        nicksPerNock: deps.config.nicksPerNock,
        priceUsd,
        monthlyCostUsd: deps.config.monthlyCostUsd,
      }),
      donateAddress: deps.config.donateAddress,
    };
  });

  return app;
}
