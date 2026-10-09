/* Independent verifier: npx tsx scripts/verify.ts r512-e3 */
import { runEvent } from "../lib/engine/engine";
import { loadEvent } from "../lib/server/league";

const id = process.argv[2];
if (!id) { console.error("usage: tsx scripts/verify.ts <eventId, e.g. r512-e3>"); process.exit(2); }

const found = await loadEvent(id);
if (!found) { console.error(`Event ${id} not found or round not closed yet.`); process.exit(2); }
const { event: e } = found;
console.log(`seed block ${e.seed.block} (${e.seed.source})  hash ${e.seed.hash}`);
const again = runEvent({ type: e.type, seedHash: e.seed.hash, eventId: e.eventId, a: e.a, b: e.b });
const ok = again.logHash === e.result.logHash && again.winner === e.result.winner;
console.log(`stored log hash   ${e.result.logHash}\nreplayed log hash ${again.logHash}`);
console.log(ok ? "VERIFIED: identical result" : "MISMATCH");
process.exit(ok ? 0 : 1);
