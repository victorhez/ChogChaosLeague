/* Precomputes the immutable aggregates of replayed-history rounds (0..167): npx tsx scripts/precompute-history.ts */
process.env.CCL_NO_HISTORY = "1";
import { writeFileSync } from "node:fs";
import { aggregate, encodeAgg, getRoster, getSeeds } from "../lib/server/league";
import { LIVE_FROM_ROUND } from "../lib/config";

(async () => {
  const roster = await getRoster();
  const rounds = Array.from({ length: LIVE_FROM_ROUND }, (_, i) => i);
  const seeds = await getSeeds(rounds);
  const out: Record<number, ReturnType<typeof encodeAgg>> = {};
  for (const r of rounds) {
    const seed = seeds.get(r)!;
    if (seed.source !== "monad") throw new Error(`Round ${r} has no Monad seed; run scripts/snapshot-seeds.mjs first`);
    out[r] = encodeAgg(aggregate(r, seed, roster, {}));
    if (r % 20 === 0) console.log("round", r);
  }
  writeFileSync(new URL("../lib/history.json", import.meta.url), JSON.stringify({ rounds: out }));
  console.log("history.json written for", rounds.length, "rounds");
})();
