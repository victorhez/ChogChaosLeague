import type { Chog } from "../chog";
import type { ArenaPair } from "@/components/Arena";
import type { DrawerChog } from "@/components/ArenaLive";
import type { EventRecord, SeasonResult } from "./league";
import { collectionChog } from "./collection";

/** First eight matchups of a round as arena actors. */
export function toPairs(events: EventRecord[]): ArenaPair[] {
  return events.slice(0, 8).map((e) => ({
    eventId: e.eventId,
    type: e.type,
    winner: e.result.winner,
    betrayal: e.result.outcome === "betrayal",
    points: e.result.points,
    a: { tokenId: e.a.tokenId, genome: e.a.genome, traits: collectionChog(e.a.tokenId)!.traits },
    b: { tokenId: e.b.tokenId, genome: e.b.genome, traits: collectionChog(e.b.tokenId)!.traits },
  }));
}

/** Drawer data for just the Chogs on screen (not the whole collection). */
export function drawerData(pairs: ArenaPair[], season: SeasonResult): Record<number, DrawerChog> {
  const st = new Map(season.standings.map((s) => [s.tokenId, s]));
  const out: Record<number, DrawerChog> = {};
  for (const p of pairs) {
    for (const who of [p.a, p.b]) {
      const c: Chog = collectionChog(who.tokenId)!;
      const s = st.get(c.tokenId);
      out[c.tokenId] = { name: c.name, genome: c.genome, traits: c.traits, rank: s?.points ? s.rank : 0, points: s?.points ?? 0, wins: s?.wins ?? 0, losses: s?.losses ?? 0, streak: s?.streak ?? 0 };
    }
  }
  return out;
}

export const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
