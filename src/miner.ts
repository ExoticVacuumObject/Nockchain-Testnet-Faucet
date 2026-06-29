import { spawn, type ChildProcess } from "node:child_process";

export function shouldMine(balanceNicks: number, floorNicks: number): boolean {
  return balanceNicks < floorNicks;
}

export interface Miner {
  mineUntil(targetNicks: number, readBalance: () => Promise<number>): Promise<void>;
  stop(): void;
}

// Mining invocation is confirmed against the live fakenet (plan Task 2 Step 5).
// Adjust bin/args/cwd to match the real start-mining command.
export function makeMiner(cfg: {
  minerBin: string;
  minerArgs: string[];
  cwd: string;
  pollMs: number;
}): Miner {
  let child: ChildProcess | null = null;

  function start(): void {
    if (!child) child = spawn(cfg.minerBin, cfg.minerArgs, { cwd: cfg.cwd, stdio: "ignore" });
  }
  function stop(): void {
    if (child) {
      child.kill("SIGTERM");
      child = null;
    }
  }

  return {
    async mineUntil(targetNicks, readBalance) {
      start();
      try {
        for (;;) {
          if ((await readBalance()) >= targetNicks) return;
          await new Promise((r) => setTimeout(r, cfg.pollMs));
        }
      } finally {
        stop();
      }
    },
    stop,
  };
}
