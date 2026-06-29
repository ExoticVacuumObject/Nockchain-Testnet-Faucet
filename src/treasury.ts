import { shouldMine, type Miner } from "./miner.js";
import type { Wallet } from "./wallet.js";

export function startTreasuryWatcher(deps: {
  wallet: Wallet;
  miner: Miner;
  floorNicks: number;
  ceilNicks: number;
  intervalMs: number;
}): { stop: () => void; lastNicks: () => number } {
  let busy = false;
  let last = 0;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      last = await deps.wallet.treasuryNicks();
      if (shouldMine(last, deps.floorNicks)) {
        await deps.miner.mineUntil(deps.ceilNicks, () => deps.wallet.treasuryNicks());
        last = await deps.wallet.treasuryNicks();
      }
    } catch (err) {
      console.error(`treasury watcher: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      busy = false;
    }
  }, deps.intervalMs);
  return { stop: () => clearInterval(timer), lastNicks: () => last };
}
