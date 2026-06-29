import { shouldMine, type Miner } from "./miner.js";
import type { Wallet } from "./wallet.js";

export function startTreasuryWatcher(deps: {
  wallet: Wallet;
  miner: Miner;
  floorNicks: number;
  ceilNicks: number;
  intervalMs: number;
}): () => void {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const bal = await deps.wallet.treasuryNicks();
      if (shouldMine(bal, deps.floorNicks)) {
        await deps.miner.mineUntil(deps.ceilNicks, () => deps.wallet.treasuryNicks());
      }
    } catch (err) {
      console.error(`treasury watcher: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      busy = false;
    }
  }, deps.intervalMs);
  return () => clearInterval(timer);
}
