import { NextResponse } from "next/server";
import { loadLeague, nudgeWindow } from "@/lib/server/league";
import { nudgeStoreKind } from "@/lib/server/nudges";

export const dynamic = "force-dynamic";

export async function GET() {
  const { state, nudges } = await loadLeague();
  return NextResponse.json({
    latestBlock: state.head.latest,
    rpcOk: state.head.ok,
    latestClosedRound: state.latestClosed,
    liveRound: state.liveRound,
    season: state.season,
    nudgeWindow: nudgeWindow(state),
    nudgesRecorded: Object.keys(nudges).length,
    nudgeStore: nudgeStoreKind(),
  });
}
