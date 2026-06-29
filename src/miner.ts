import { spawn } from "node:child_process";

export function shouldMine(balanceNicks: number, floorNicks: number): boolean {
  return balanceNicks < floorNicks;
}

export interface MinerProcess {
  kill(): void;
  on(event: "exit" | "error", cb: (arg?: unknown) => void): void;
}

export type Spawner = () => MinerProcess;

export interface Miner {
  mineUntil(targetNicks: number, readBalance: () => Promise<number>): Promise<void>;
  stop(): void;
}

// Mining invocation is confirmed against the live fakenet (plan Task 2 Step 5).
// Adjust bin/args/cwd to match the real start-mining command.
function defaultSpawner(cfg: { minerBin: string; minerArgs: string[]; cwd: string }): Spawner {
  return () => {
    const child = spawn(cfg.minerBin, cfg.minerArgs, { cwd: cfg.cwd, stdio: "ignore" });
    return {
      kill: () => void child.kill("SIGTERM"),
      on: (event, cb) => void child.on(event, cb as (...a: unknown[]) => void),
    };
  };
}

export function makeMiner(cfg: {
  minerBin: string;
  minerArgs: string[];
  cwd: string;
  pollMs: number;
  maxMineMs: number;
  spawner?: Spawner;
  now?: () => number;
}): Miner {
  const spawner = cfg.spawner ?? defaultSpawner(cfg);
  const now = cfg.now ?? (() => Date.now());
  let proc: MinerProcess | null = null;

  function stop(): void {
    if (proc) {
      proc.kill();
      proc = null;
    }
  }

  return {
    async mineUntil(targetNicks, readBalance) {
      let exited = false;
      let failure: Error | null = null;
      const startedAt = now();
      proc = spawner();
      proc.on("exit", () => {
        exited = true;
      });
      proc.on("error", (err) => {
        failure = err instanceof Error ? err : new Error(String(err));
      });
      try {
        for (;;) {
          if (failure) throw new Error(`miner failed: ${(failure as Error).message}`);
          if (exited) throw new Error("miner exited before reaching target");
          if ((await readBalance()) >= targetNicks) return;
          if (now() - startedAt >= cfg.maxMineMs) throw new Error("mining timed out");
          await new Promise((r) => setTimeout(r, cfg.pollMs));
        }
      } finally {
        stop();
      }
    },
    stop,
  };
}
