import type { Chog } from "../chog";
import type { ArenaPair } from "@/components/Arena";
import type { DrawerChog } from "@/components/ArenaLive";
import type { EventRecord, SeasonResult } from "./league";

export function toPairs(events: EventRecord[], roster: Chog[]): ArenaPair[] {
  const by = new Map(roster.map((c) => [c.tokenId, c]));
  return events.slice(0, 8).map((e) => ({
    eventId: e.eventId,
    type: e.type,
    winner: e.result.winner,
    betrayal: e.result.outcome === "betrayal",
    points: e.result.points,
    a: { tokenId: e.a.tokenId, genome: e.a.genome, traits: by.get(e.a.tokenId)!.traits },
    b: { tokenId: e.b.tokenId, genome: e.b.genome, traits: by.get(e.b.tokenId)!.traits },
  }));
}

export function drawerData(roster: Chog[], season: SeasonResult): Record<number, DrawerChog> {
  const st = new Map(season.standings.map((s) => [s.tokenId, s]));
  const out: Record<number, DrawerChog> = {};
  for (const c of roster) {
    const s = st.get(c.tokenId);
    out[c.tokenId] = { name: c.name, genome: c.genome, traits: c.traits, rank: s?.rank ?? 0, points: s?.points ?? 0, wins: s?.wins ?? 0, losses: s?.losses ?? 0, streak: s?.streak ?? 0 };
  }
  return out;
}

export const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
