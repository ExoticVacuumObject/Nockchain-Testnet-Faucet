export interface Config {
  port: number;
  claimAmount: number;
  cooldownHours: number;
  treasuryFloor: number;
  treasuryCeil: number;
  donateAddress: string;
  monthlyCostUsd: number;
  nicksPerNock: number;
  dbPath: string;
  faucetPkh: string;
  balanceApiUrl: string;
  priceUrl: string;
  walletBin: string;
  walletGrpcPort: number;
  treasuryPollMs: number;
  donationPollMs: number;
}

function req(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (v === undefined || v === "") throw new Error(`missing env: ${key}`);
  return v;
}

function num(env: NodeJS.ProcessEnv, key: string): number {
  const raw = req(env, key).trim();
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n)) throw new Error(`invalid number env: ${key}`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cfg: Config = {
    port: num(env, "PORT"),
    claimAmount: num(env, "CLAIM_AMOUNT"),
    cooldownHours: num(env, "COOLDOWN_HOURS"),
    treasuryFloor: num(env, "TREASURY_FLOOR"),
    treasuryCeil: num(env, "TREASURY_CEIL"),
    donateAddress: req(env, "DONATE_ADDRESS"),
    monthlyCostUsd: num(env, "MONTHLY_COST_USD"),
    nicksPerNock: num(env, "NICKS_PER_NOCK"),
    dbPath: req(env, "DB_PATH"),
    faucetPkh: req(env, "FAUCET_PKH"),
    balanceApiUrl: req(env, "BALANCE_API_URL"),
    priceUrl: req(env, "PRICE_URL"),
    walletBin: req(env, "WALLET_BIN"),
    walletGrpcPort: num(env, "WALLET_GRPC_PORT"),
    treasuryPollMs: num(env, "TREASURY_POLL_MS"),
    donationPollMs: num(env, "DONATION_POLL_MS"),
  };
  if (cfg.claimAmount <= 0) throw new Error("CLAIM_AMOUNT must be greater than 0");
  if (cfg.cooldownHours <= 0) throw new Error("COOLDOWN_HOURS must be greater than 0");
  if (cfg.monthlyCostUsd <= 0) throw new Error("MONTHLY_COST_USD must be greater than 0");
  if (cfg.nicksPerNock <= 0) throw new Error("NICKS_PER_NOCK must be greater than 0");
  if (cfg.walletGrpcPort <= 0) throw new Error("WALLET_GRPC_PORT must be greater than 0");
  if (cfg.treasuryPollMs <= 0) throw new Error("TREASURY_POLL_MS must be greater than 0");
  if (cfg.donationPollMs <= 0) throw new Error("DONATION_POLL_MS must be greater than 0");
  if (cfg.treasuryFloor >= cfg.treasuryCeil) {
    throw new Error("TREASURY_FLOOR must be less than TREASURY_CEIL");
  }
  return cfg;
}
