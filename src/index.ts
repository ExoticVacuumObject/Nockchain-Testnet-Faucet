import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { clearPendingClaims } from "./claims.js";
import { makeWallet } from "./wallet.js";
import { makeMiner } from "./miner.js";
import { makePriceCache } from "./price.js";
import { buildServer } from "./server.js";
import { startTreasuryWatcher } from "./treasury.js";
import { applyBalanceSnapshot, balanceFromResponse } from "./donations.js";

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
clearPendingClaims(db); // release orphaned reserves left by any prior crash

const wallet = makeWallet({
  walletBin: cfg.walletBin,
  nodeSocket: cfg.nodeSocket,
  faucetPkh: cfg.faucetPkh,
  nicksPerNock: cfg.nicksPerNock,
});

// Miner invocation is integration-determined (plan Task 2); supplied via env.
const miner = makeMiner({
  minerBin: process.env.MINER_BIN ?? "true",
  minerArgs: (process.env.MINER_ARGS ?? "").split(" ").filter(Boolean),
  cwd: process.env.MINER_CWD ?? ".",
  pollMs: Number(process.env.MINER_POLL_MS ?? 10_000),
  maxMineMs: Number(process.env.MAX_MINE_MS ?? 30 * 60_000),
});

const price = makePriceCache({ url: cfg.priceUrl, ttlMs: 5 * 60_000 });

const watcher = startTreasuryWatcher({
  wallet,
  miner,
  floorNicks: cfg.treasuryFloor * cfg.nicksPerNock,
  ceilNicks: cfg.treasuryCeil * cfg.nicksPerNock,
  intervalMs: cfg.treasuryPollMs,
});

const app = buildServer({ db, wallet, price, config: cfg, treasuryNicks: watcher.lastNicks });

async function pollDonations(): Promise<void> {
  try {
    const res = await fetch(`${cfg.balanceApiUrl}/balance/${cfg.donateAddress}`);
    const body = await res.json().catch(() => null);
    const balance = balanceFromResponse(res.ok, body);
    if (balance !== null) applyBalanceSnapshot(db, balance, Math.floor(Date.now() / 1000));
  } catch (err) {
    console.error(`donation poll: ${err instanceof Error ? err.message : String(err)}`);
  }
}
void pollDonations();
const donationTimer = setInterval(pollDonations, cfg.donationPollMs);

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`received ${signal}, shutting down`);
  watcher.stop();
  miner.stop();
  clearInterval(donationTimer);
  app.close().finally(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

app
  .listen({ port: cfg.port, host: "127.0.0.1" })
  .then(() => console.log(`nock-faucet listening on 127.0.0.1:${cfg.port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
