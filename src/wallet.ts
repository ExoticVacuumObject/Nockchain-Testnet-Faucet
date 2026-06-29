import { execFile } from "node:child_process";

export type Runner = (bin: string, args: string[]) => Promise<string>;

const defaultRun: Runner = (bin, args) =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${bin} failed: ${stderr || err.message}`));
      else resolve(stdout);
    });
  });

export interface Wallet {
  send(address: string, amountNock: number): Promise<string>;
  treasuryNicks(): Promise<number>;
}

interface WalletCfg {
  walletBin: string;
  nodeSocket: string;
  faucetPkh: string;
  nicksPerNock: number;
  run?: Runner;
}

// Command construction and parsing. Flags are provisional until confirmed against
// the live fakenet CLI; keep all CLI-specific strings inside these four functions.
function buildSendArgs(cfg: WalletCfg, address: string, amountNock: number): string[] {
  return ["--socket", cfg.nodeSocket, "send", "--to", address, "--amount", String(amountNock)];
}
function buildBalanceArgs(cfg: WalletCfg): string[] {
  return ["--socket", cfg.nodeSocket, "list-notes-by-address", cfg.faucetPkh];
}
function parseTxid(stdout: string): string {
  const m = stdout.match(/txid:\s*(\S+)/i);
  if (!m) throw new Error(`could not parse txid from: ${stdout.slice(0, 200)}`);
  return m[1];
}
function parseTotalNicks(stdout: string): number {
  const m = stdout.match(/total:\s*(\d+)/i);
  if (!m) throw new Error(`could not parse balance from: ${stdout.slice(0, 200)}`);
  return Number(m[1]);
}

export function makeWallet(cfg: WalletCfg): Wallet {
  const run = cfg.run ?? defaultRun;
  return {
    async send(address, amountNock) {
      return parseTxid(await run(cfg.walletBin, buildSendArgs(cfg, address, amountNock)));
    },
    async treasuryNicks() {
      return parseTotalNicks(await run(cfg.walletBin, buildBalanceArgs(cfg)));
    },
  };
}
