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
  treasuryNicks(): Promise<number>;
  send(address: string, amountNock: number): Promise<string>;
  watchAddress(pkh: string): Promise<void>;
}

interface WalletCfg {
  walletBin: string;
  grpcPort: number;
  nicksPerNock: number;
  run?: Runner;
}

// Global flags to reach the local fakenet node's PRIVATE gRPC. These are top-level
// options, so they precede the subcommand.
function conn(cfg: WalletCfg): string[] {
  return ["--client", "private", "--private-grpc-server-port", String(cfg.grpcPort)];
}

// `show-balance` prints a summary that includes the line: "- Balance: <nicks> nicks".
function parseBalanceNicks(stdout: string): number {
  const m = stdout.match(/Balance:\s*(\d+)\s*nicks/i);
  if (!m) throw new Error(`could not parse balance from: ${stdout.slice(-200)}`);
  return Number(m[1]);
}

// `create-tx` builds and signs a transaction and surfaces the path of the tx file that
// `send-tx` then broadcasts. The exact path-surfacing is confirmed on the first live send.
function parseTxFile(stdout: string): string {
  const m = stdout.match(/([^\s'"]+\.tx)\b/);
  if (!m) throw new Error(`could not find tx file in: ${stdout.slice(-200)}`);
  return m[1];
}

// `send-tx` reports the broadcast transaction id.
function parseTxid(stdout: string): string {
  const m = stdout.match(/(?:txid|transaction id|tx id)\b[:\s]+([A-Za-z0-9]+)/i);
  if (!m) throw new Error(`could not parse txid from: ${stdout.slice(-200)}`);
  return m[1];
}

export function makeWallet(cfg: WalletCfg): Wallet {
  const run = cfg.run ?? defaultRun;
  return {
    async treasuryNicks() {
      return parseBalanceNicks(await run(cfg.walletBin, [...conn(cfg), "show-balance"]));
    },
    async send(address, amountNock) {
      const nicks = amountNock * cfg.nicksPerNock;
      const created = await run(cfg.walletBin, [
        ...conn(cfg),
        "create-tx",
        "--recipient",
        `${address}:${nicks}`,
      ]);
      const broadcast = await run(cfg.walletBin, [...conn(cfg), "send-tx", parseTxFile(created)]);
      return parseTxid(broadcast);
    },
    async watchAddress(pkh) {
      await run(cfg.walletBin, [...conn(cfg), "watch", "address", pkh]);
    },
  };
}
