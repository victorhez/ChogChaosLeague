import { NextResponse } from "next/server";
import { getHead, leagueState, getSeeds, getRoster } from "@/lib/server/league";
import { nudgeStoreHealth } from "@/lib/server/nudges";
import { CHOG_CONTRACT, LEDGER_ADDRESS, LIVE_FROM_ROUND } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  const head = await getHead();
  const st = leagueState(head);
  const seed = (await getSeeds([st.latestClosed])).get(st.latestClosed);
  const roster = await getRoster();
  return NextResponse.json({
    ok: head.ok && Boolean(seed),
    rpc: head.ok ? "up" : "down (running on fallback seeds)",
    latestBlock: head.latest,
    latestClosedRound: st.latestClosed,
    lastSeed: seed,
    rosterSize: roster.length,
    rosterSource: `Chog Genesis ${CHOG_CONTRACT}`,
    liveFromRound: LIVE_FROM_ROUND,
    liveRoundsClosed: st.liveRoundsClosed,
    ledger: LEDGER_ADDRESS || "not deployed",
    nudgeStore: await nudgeStoreHealth(),
    latencyMs: Date.now() - t0,
  });
}
