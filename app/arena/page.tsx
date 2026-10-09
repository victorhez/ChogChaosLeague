import type { Metadata } from "next";
import { ArenaLive } from "@/components/ArenaLive";
import { EventRow, PageHead } from "@/components/bits";
import { computeSeason, loadLeague, recentRounds } from "@/lib/server/league";
import { drawerData, fmtDuration, toPairs } from "@/lib/server/view";

export const metadata: Metadata = { title: "Arena" };
export const maxDuration = 60;
export const revalidate = 15;

export default async function ArenaPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const sp = await searchParams;
  const { state, roster, nudges } = await loadLeague();
  const rounds = await recentRounds(state.latestClosed, 6, roster, nudges);
  const pick = rounds.find((r) => String(r.roundId) === sp.round) ?? rounds[0];
  const season = await computeSeason(state.season, state.latestClosed, roster, nudges);

  return (
    <div className="wrap" style={{ padding: "36px 0 72px" }}>
      <PageHead eyebrow="Live arena" title="The Pixel Meadow">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="pill pill-mint"><span className="dot" /> Head block {state.head.latest.toLocaleString("en-US")}</span>
          <span className="pill">Next lock in {fmtDuration(state.secondsToLock)}</span>
          {!state.head.ok && <span className="pill pill-orange">RPC offline · fallback seeds</span>}
        </div>
      </PageHead>

      <nav aria-label="Rounds" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {rounds.map((r) => (
          <a key={r.roundId} className={`btn btn-sm ${r.roundId === pick.roundId ? "btn-purple" : "btn-ghost"}`} href={`/arena?round=${r.roundId}`}>Round {r.roundId}</a>
        ))}
      </nav>

      <div className="layout-arena">
        <div style={{ display: "grid", gap: 14 }}>
          <ArenaLive pairs={toPairs(pick.events, roster)} chogs={drawerData(roster, season)} label={`Round ${pick.roundId}`} />
          <p className="muted">Tap any Chog to open its profile. The meadow shows the first eight matchups of the round; the feed lists all {pick.events.length}. Every card links to a replay.</p>
        </div>
        <div className="feed" aria-label={`Events in round ${pick.roundId}`}>
          {pick.events.map((e) => <EventRow key={e.eventId} e={e} />)}
        </div>
      </div>
    </div>
  );
}
