import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChogImage, EventRow, GeneBars, PixelSprite } from "@/components/bits";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isRare, traitDelta } from "@/lib/genome/genome";
import { CHAIN, CHOG_CONTRACT, COLLECTION_SIZE } from "@/lib/config";
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
  return { title: `${c.name} · token #${n}`, description: `Genes, career and replayable events for ${c.name} (token #${n}).`, openGraph: { images: [`/api/img/${n}`] } };
}

export default async function ChogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenId = Number(id);
  if (!validTokenId(tokenId)) notFound();
  const chog = await getChog(tokenId);
  const { state, roster, nudges } = await loadLeague();

  const seasons = await Promise.all(Array.from({ length: state.season + 1 }, (_, s) => computeSeason(s, state.latestClosed, roster, nudges)));
  const events = await tokenEvents(tokenId, state.season, state.latestClosed, roster, nudges);
  const lastLoss = events.find((e) => (e.a.tokenId === tokenId ? e.result.winner === "b" : e.result.winner === "a"));
  const rivalId = lastLoss ? (lastLoss.a.tokenId === tokenId ? lastLoss.b.tokenId : lastLoss.a.tokenId) : null;
  const career = seasons
    .map((s) => ({ s, row: s.standings.find((x) => x.tokenId === tokenId)!, proof: careerProof(s, tokenId)! }))
    .filter((c) => c.s.rounds > 0)
    .reverse();
  const dom = dominantGene(chog.genome);

  return (
    <div className="wrap" style={{ padding: "36px 0 72px" }}>
      <div className="layout-arena" style={{ gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1.3fr)" }}>
        <div className="card card-hard" style={{ textAlign: "center" }}>
          <div className="eyebrow">Chog Genesis · token #{tokenId}</div>
          <div style={{ margin: "12px auto", maxWidth: 300 }}><ChogImage id={tokenId} size={300} alt={chog.name} /></div>
          <h1 style={{ fontSize: "2rem", margin: "8px 0 4px" }}>{chog.name}</h1>
          <p className="muted" style={{ marginBottom: 4 }}>Dominant gene: <b style={{ color: "var(--cloud)", textTransform: "capitalize" }}>{dom}</b></p>
          <p className="muted mono" style={{ fontSize: ".78rem", marginBottom: 14 }}>The number in the name comes from metadata and can differ from the token id.</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
            <PixelSprite id={tokenId} size={48} alt="Pixel avatar" /><span className="muted">Pixel avatar (in-arena style)</span>
          </div>
          <div style={{ textAlign: "left" }}><GeneBars genome={chog.genome} /></div>
          <a className="muted" style={{ textDecoration: "underline", fontSize: ".85rem", display: "inline-block", marginTop: 12 }} href={`${CHAIN.explorer}/token/${CHOG_CONTRACT}?a=${tokenId}`} target="_blank" rel="noreferrer">View token on Monadscan</a>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <div className="card">
            <h3>Traits become genes</h3>
            <p className="muted" style={{ margin: "6px 0 14px" }}>Each real trait adds to the genome through the public mapping table. Rare values are marked ★. Every gene&apos;s trait bonus is capped, so no single trait decides a match.</p>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Trait</th><th>Value</th><th>Gene effect</th></tr></thead>
                <tbody>
                  {Object.entries(chog.traits).map(([k, v]) => {
                    const d = traitDelta(k, v);
                    return (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{v}{isRare(k, v) ? <span className="pill pill-orange" style={{ marginLeft: 6 }}>★ rare</span> : null}</td>
                        <td className="mono muted">{Object.entries(d).map(([g, n]) => `${g} +${n}`).join(", ") || "none"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: ".85rem" }}><Link href="/fairness#genes" style={{ textDecoration: "underline" }}>See the full mapping table</Link>.</p>
          </div>

          <div className="card">
            <h3>Career record</h3>
            <p className="muted" style={{ margin: "6px 0 14px" }}>Season results are keyed by token ID and rolled into a Merkle root per season. The proof is checked in your browser. Season 0 is replayed history; owner nudges only exist from season 1.</p>
            {career.length === 0 ? <p className="muted">No closed rounds in a season yet.</p> : (
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Season</th><th>Rank / {COLLECTION_SIZE}</th><th>Pts</th><th>W-L</th><th>Best streak</th><th>Badges</th><th>Proof</th></tr></thead>
                  <tbody>
                    {career.map(({ s, row, proof }) => (
                      <tr key={s.seasonId}>
                        <td>S{s.seasonId}{s.history ? " · replayed history" : s.complete ? "" : " · live"}</td>
                        <td>#{row.rank}</td><td>{row.points}</td><td>{row.wins}-{row.losses}</td><td>{row.bestStreak}</td>
                        <td>{row.badges.length ? row.badges.map((b) => <span key={b} className="pill pill-orange" style={{ marginRight: 4 }}>{b}</span>) : <span className="muted">none yet</span>}</td>
                        <td><VerifiedBadge leaf={proof.leaf} proof={proof.proof} root={proof.root} complete={s.complete} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <section style={{ marginTop: 36 }}>
        <div className="sectionhead">
          <div><div className="eyebrow">Season {state.season}</div><h2 style={{ marginTop: 8 }}>Recent events</h2></div>
          {rivalId && lastLoss && (
            <Link href={`/event/${lastLoss.eventId}`} className="pill pill-orange">Rival of the week: {(await getChog(rivalId)).name} · revenge pending</Link>
          )}
        </div>
        <div className="grid g2">
          {events.slice(0, 10).map((e) => <EventRow key={e.eventId} e={e} />)}
          {events.length === 0 && <p className="muted">No events yet this season. The first live round closes within the hour.</p>}
        </div>
      </section>
    </div>
  );
}
