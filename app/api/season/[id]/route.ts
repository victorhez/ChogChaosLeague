import { NextResponse } from "next/server";
import { computeSeason, loadLeague } from "@/lib/server/league";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Public season summary. Anyone can recompute `root` from public data and compare. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seasonId = Number(id);
  const { state, roster, nudges } = await loadLeague();
  if (!Number.isInteger(seasonId) || seasonId < 0 || seasonId > state.season) return NextResponse.json({ error: "Unknown season" }, { status: 404 });
  const s = await computeSeason(seasonId, state.latestClosed, roster, nudges);
  return NextResponse.json({
    seasonId, root: s.root, rounds: s.rounds, complete: s.complete, history: s.history, historyRounds: s.historyRounds,
    leaves: s.standings.length, top3: s.standings.slice(0, 3).map((x) => ({ tokenId: x.tokenId, points: x.points, wins: x.wins })),
  });
}
