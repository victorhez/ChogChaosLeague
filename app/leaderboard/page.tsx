import type { Metadata } from "next";
import Link from "next/link";
import { PageHead, Sprite } from "@/components/bits";
import { chogName } from "@/lib/chog";
import { ROUNDS_PER_SEASON } from "@/lib/config";
import { computeSeason, loadLeague } from "@/lib/server/league";

export const metadata: Metadata = { title: "Leaderboard" };
export const maxDuration = 60;
export const revalidate = 30;

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const sp = await searchParams;
  const { state, roster, nudges } = await loadLeague();
  const sid = Math.min(state.season, Math.max(0, Number(sp.season ?? state.season) || 0));
  const season = await computeSeason(sid, state.latestClosed, roster, nudges);
  const top = season.standings.slice(0, 25);
  const [first, second] = season.standings;
  const maxStreak = [...season.standings].sort((a, b) => b.bestStreak - a.bestStreak)[0];

  return (
    <div className="wrap" style={{ padding: "36px 0 72px" }}>
      <PageHead eyebrow={`Season ${sid} · ${season.rounds} of ${ROUNDS_PER_SEASON} rounds${season.complete ? " · final" : " · live"}`} title="Leaderboard" />
      <nav aria-label="Seasons" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {Array.from({ length: state.season + 1 }, (_, s) => (
          <Link key={s} href={`/leaderboard?season=${s}`} className={`btn btn-sm ${s === sid ? "btn-purple" : "btn-ghost"}`}>Season {s}{s === state.season ? " · live" : ""}</Link>
        ))}
      </nav>

      <div className="grid g3" style={{ marginBottom: 24 }}>
        <div className="card card-hard">
          <div className="eyebrow">{season.complete ? "Champion" : "Leading"}</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
            <Sprite id={first.tokenId} size={72} />
            <div><h3>{chogName(first.tokenId)}</h3><p className="muted">{first.points} pts · {first.wins}W</p></div>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Rivalry of the week</div>
          <p style={{ marginTop: 8 }}><b>{chogName(first.tokenId)}</b> vs <b>{chogName(second.tokenId)}</b></p>
          <p className="muted">{first.points - second.points} points apart at the top.</p>
          <Link href={`/chog/${second.tokenId}`} className="muted" style={{ textDecoration: "underline" }}>Challenger profile</Link>
        </div>
        <div className="card">
          <div className="eyebrow">Season recap</div>
          <p style={{ marginTop: 8 }}>Longest streak: <b>{chogName(maxStreak.tokenId)}</b> ({maxStreak.bestStreak})</p>
          {season.best && <Link href={`/event/${season.best.eventId}`} style={{ textDecoration: "underline" }}>Top moment: {season.best.points} pts in one event →</Link>}
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>#</th><th>Chog</th><th>Points</th><th>W-L-D</th><th>Streak</th><th>Upsets</th><th>Badges</th></tr></thead>
          <tbody>
            {top.map((s) => (
              <tr key={s.tokenId}>
                <td className="mono">{s.rank}</td>
                <td><Link href={`/chog/${s.tokenId}`} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Sprite id={s.tokenId} size={32} />{chogName(s.tokenId)} <span className="muted mono">#{s.tokenId}</span></Link></td>
                <td><b>{s.points}</b></td>
                <td>{s.wins}-{s.losses}-{s.draws}</td>
                <td>{s.bestStreak}</td>
                <td>{s.upsets}</td>
                <td>{s.badges.map((b) => <span key={b} className="pill pill-orange" style={{ marginRight: 4 }}>{b}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted mono" style={{ marginTop: 14, fontSize: ".8rem" }}>Season root: {season.root}</p>
    </div>
  );
}
