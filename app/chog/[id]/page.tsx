import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventRow, GeneBars, Sprite } from "@/components/bits";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isRare, MAPPING_RARE } from "@/lib/genome/genome";
import { LEAGUE_SIZE } from "@/lib/config";
import { dominantGene } from "@/lib/chog";
import { careerProof, computeSeason, loadLeague, tokenEvents } from "@/lib/server/league";
import { getChog, validTokenId } from "@/lib/server/chogs";

export const revalidate = 60;
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const n = Number(id);
  if (!validTokenId(n)) return { title: "Chog not found" };
  const c = await getChog(n);
  return { title: `${c.name} #${n}`, description: `Genes, career and replayable events for Chog #${n}.` };
}

export default async function ChogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenId = Number(id);
  if (!validTokenId(tokenId)) notFound();
  const chog = await getChog(tokenId);
  const { state, roster, nudges } = await loadLeague();
  const inLeague = tokenId <= LEAGUE_SIZE;

  const seasons = inLeague
    ? await Promise.all(Array.from({ length: state.season + 1 }, (_, s) => computeSeason(s, state.latestClosed, roster, nudges)))
    : [];
  const events = inLeague ? await tokenEvents(tokenId, state.season, state.latestClosed, roster, nudges) : [];
  const lastLoss = events.find((e) => (e.a.tokenId === tokenId ? e.result.winner === "b" : e.result.winner === "a"));
  const rivalId = lastLoss ? (lastLoss.a.tokenId === tokenId ? lastLoss.b.tokenId : lastLoss.a.tokenId) : null;
  const career = seasons.map((s) => ({ s, row: s.standings.find((x) => x.tokenId === tokenId)!, proof: careerProof(s, tokenId)! })).reverse();
  const dom = dominantGene(chog.genome);

  return (
    <div className="wrap" style={{ padding: "36px 0 72px" }}>
      <div className="layout-arena" style={{ gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1.3fr)" }}>
        <div className="card card-hard" style={{ textAlign: "center" }}>
          <div className="eyebrow">Chog #{tokenId} · {chog.source === "chain" ? "on-chain traits" : "demo traits"}</div>
          <Sprite id={tokenId} size={220} alt={chog.name} />
          <h1 style={{ fontSize: "2rem", margin: "8px 0 4px" }}>{chog.name}</h1>
          <p className="muted" style={{ marginBottom: 18 }}>Dominant gene: <b style={{ color: "var(--cloud)", textTransform: "capitalize" }}>{dom}</b></p>
          <div style={{ textAlign: "left" }}><GeneBars genome={chog.genome} /></div>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <div className="card">
            <h3>Traits become genes</h3>
            <p className="muted" style={{ margin: "6px 0 14px" }}>Each trait adds to the genome through the public mapping table. Rare traits are marked, and capped so no single trait decides a match.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(chog.traits).map(([k, v]) => (
                <span key={k} className={`pill ${isRare(k, v) ? "pill-orange" : ""}`}>{k}: {v}{isRare(k, v) ? " ★" : ""}</span>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: ".85rem" }}>Rare values: {Object.values(MAPPING_RARE).join(", ")}. <Link href="/fairness#genes" style={{ textDecoration: "underline" }}>See the full table</Link>.</p>
          </div>

          {!inLeague && (
            <div className="notice">
              Spectating: Chog #{tokenId} is outside the {LEAGUE_SIZE}-Chog launch meadow, so it has no rounds yet. Its genome is real and deterministic. The ledger covers token IDs 1 to {LEAGUE_SIZE} in this build.
            </div>
          )}

          {inLeague && (
            <div className="card">
              <h3>Career record</h3>
              <p className="muted" style={{ margin: "6px 0 14px" }}>Season results are keyed by token ID and rolled into a Merkle root per season. The proof below is checked in your browser.</p>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Season</th><th>Rank</th><th>Pts</th><th>W-L</th><th>Best streak</th><th>Badges</th><th>Proof</th></tr></thead>
                  <tbody>
                    {career.map(({ s, row, proof }) => (
                      <tr key={s.seasonId}>
                        <td>S{s.seasonId}{s.complete ? "" : " (live)"}</td>
                        <td>#{row.rank}</td><td>{row.points}</td><td>{row.wins}-{row.losses}</td><td>{row.bestStreak}</td>
                        <td>{row.badges.length ? row.badges.map((b) => <span key={b} className="pill pill-orange" style={{ marginRight: 4 }}>{b}</span>) : <span className="muted">none yet</span>}</td>
                        <td><VerifiedBadge leaf={proof.leaf} proof={proof.proof} root={proof.root} complete={s.complete} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {inLeague && (
        <section style={{ marginTop: 36 }}>
          <div className="sectionhead">
            <div><div className="eyebrow">This season</div><h2 style={{ marginTop: 8 }}>Recent events</h2></div>
            {rivalId && lastLoss && (
              <Link href={`/event/${lastLoss.eventId}`} className="pill pill-orange">Rival of the week: {roster.find((c) => c.tokenId === rivalId)?.name} · revenge pending</Link>
            )}
          </div>
          <div className="grid g2">
            {events.slice(0, 10).map((e) => <EventRow key={e.eventId} e={e} />)}
            {events.length === 0 && <p className="muted">No events yet this season.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
