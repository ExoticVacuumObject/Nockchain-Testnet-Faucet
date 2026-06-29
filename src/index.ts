import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { clearPendingClaims } from "./claims.js";
import { makeWallet } from "./wallet.js";
import { makeMiner } from "./miner.js";
import { makePriceCache } from "./price.js";
import { buildServer } from "./server.js";
import { startTreasuryWatcher } from "./treasury.js";
import { applyBalanceSnapshot, balanceFromResponse } from "./donations.js";

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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
  pollMs: intEnv("MINER_POLL_MS", 10_000),
  maxMineMs: intEnv("MAX_MINE_MS", 30 * 60_000),
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

let pollBusy = false;
async function pollDonations(): Promise<void> {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const res = await fetch(`${cfg.balanceApiUrl}/balance/${cfg.donateAddress}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => null);
    const balance = balanceFromResponse(res.ok, body);
    if (balance !== null) applyBalanceSnapshot(db, balance, Math.floor(Date.now() / 1000));
  } catch (err) {
    console.error(`donation poll: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    pollBusy = false;
  }
}
void pollDonations();
const donationTimer = setInterval(pollDonations, cfg.donationPollMs);

let shuttingDown = false;
function shutdown(signal: string, code = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`received ${signal}, shutting down`);
  watcher.stop();
  miner.stop();
  clearInterval(donationTimer);
  setTimeout(() => process.exit(code), 5000).unref(); // force exit if close hangs
  app.close().finally(() => {
    db.close();
    process.exit(code);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error(`unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});
process.on("uncaughtException", (err) => {
  console.error(`uncaught exception: ${err.message}`);
  shutdown("uncaughtException", 1);
});

app
  .listen({ port: cfg.port, host: "127.0.0.1" })
  .then(() => console.log(`nock-faucet listening on 127.0.0.1:${cfg.port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
