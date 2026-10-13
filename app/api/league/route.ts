import { NextResponse } from "next/server";
import { loadLeague, nudgeWindow } from "@/lib/server/league";
import { nudgeStoreKind } from "@/lib/server/nudges";
import { LIVE_FROM_ROUND } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const { state, roster, nudges } = await loadLeague();
  return NextResponse.json({
    latestBlock: state.head.latest,
    rpcOk: state.head.ok,
    latestClosedRound: state.latestClosed,
    liveFromRound: LIVE_FROM_ROUND,
    liveRoundsClosed: state.liveRoundsClosed,
    liveRound: state.liveRound,
    season: state.season,
    rosterSize: roster.length,
    eventsPerRound: Math.floor(roster.length / 2),
    nudgeWindow: nudgeWindow(state),
    nudgesRecorded: Object.keys(nudges).length,
    nudgeStore: nudgeStoreKind(),
  });
}
