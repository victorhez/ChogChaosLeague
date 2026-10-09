import Image from "next/image";
import Link from "next/link";
import { ArenaLive } from "@/components/ArenaLive";
import { EventRow, Sprite, EVENT_LABEL } from "@/components/bits";
import { chogName } from "@/lib/chog";
import { computeSeason, loadLeague, recentRounds } from "@/lib/server/league";
import { drawerData, fmtDuration, toPairs } from "@/lib/server/view";

export const revalidate = 20;

export default async function Home() {
  const { state, roster, nudges } = await loadLeague();
  const rounds = await recentRounds(state.latestClosed, 3, roster, nudges);
  const season = await computeSeason(state.season, state.latestClosed, roster, nudges);
  const latest = rounds[0];
  const feed = rounds.flatMap((r) => r.events).slice(0, 6);
  const hot = rounds.flatMap((r) => r.events).filter((e) => e.result.highlight).slice(0, 3);
  const totalEvents = (state.latestClosed + 1) * (roster.length / 2);
  const ticker = rounds.flatMap((r) => r.events).slice(0, 12);

  return (
    <>
      <section className="hero wrap">
        <div className="hero-grid">
          <div>
            <div className="pill pill-mint" style={{ marginBottom: 20 }}><span className="dot" /> Live on Monad · round {latest.roundId}</div>
            <h1>
              Your Chog is not a picture.<br />
              It is a creature with a <span className="hl">career.</span>
            </h1>
            <p className="lead">
              Every Chog becomes a mischievous pixel creature. Its traits are its genes. Each hour the meadow runs a round of pranks, duels, races and betrayals, seeded by a Monad block hash anyone can replay.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/arena" className="btn btn-primary">Watch the meadow</Link>
              <Link href="/play" className="btn btn-purple">Wake your Chog</Link>
              <Link href="/fairness" className="btn btn-ghost">How it stays fair</Link>
            </div>
          </div>
          <div className="hero-art">
            <Image src="/wordmark.png" alt="Chog Chaos League" width={900} height={675} priority style={{ width: "100%", height: "auto", borderRadius: 28 }} />
          </div>
        </div>
      </section>

      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {[...ticker, ...ticker].map((e, i) => (
            <span key={i}>
              <b>{chogName(e.a.tokenId)}</b> vs <b>{chogName(e.b.tokenId)}</b> · {EVENT_LABEL[e.type]} · {e.result.winner === "draw" ? "draw" : `${chogName(e.result.winner === "a" ? e.a.tokenId : e.b.tokenId)} wins`}
            </span>
          ))}
        </div>
      </div>

      <section className="section wrap">
        <div className="stats">
          <div className="stat"><b>{latest.roundId}</b><span>Rounds played</span></div>
          <div className="stat"><b>{totalEvents.toLocaleString("en-US")}</b><span>Chaos events, all replayable</span></div>
          <div className="stat"><b>S{state.season}</b><span>Season · {season.rounds} / 168 rounds</span></div>
          <div className="stat"><b>{fmtDuration(state.secondsToLock)}</b><span>until next nudge lock</span></div>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 72 }}>
        <div className="sectionhead">
          <div><div className="eyebrow">The meadow</div><h2 style={{ marginTop: 8 }}>Round {latest.roundId}, as it happened</h2></div>
          <Link href="/arena" className="btn btn-ghost btn-sm">Open full arena</Link>
        </div>
        <div className="layout-arena">
          <ArenaLive pairs={toPairs(latest.events, roster)} chogs={drawerData(roster, season)} label={`Round ${latest.roundId}`} />
          <div className="feed" aria-label="Latest events">
            {feed.map((e) => <EventRow key={e.eventId} e={e} />)}
          </div>
        </div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <div className="eyebrow">Why the NFT is essential</div>
        <h2 style={{ margin: "8px 0 28px" }}>One token. Three jobs.</h2>
        <div className="grid g3">
          <div className="card role" style={{ ["--c" as string]: "var(--cyan)" }}>
            <div className="n">01</div><h3>Character</h3>
            <p>Traits are decoded into five genes: Mischief, Nerve, Wit, Speed and Charm. The mapping table is public and deterministic. Same Chog, same genome, every time.</p>
          </div>
          <div className="card role" style={{ ["--c" as string]: "var(--orange)" }}>
            <div className="n">02</div><h3>Key</h3>
            <p>Owning the token is what lets you set the daily nudge. Ownership is checked at lock time, so a sold Chog is steered by its new owner.</p>
          </div>
          <div className="card role" style={{ ["--c" as string]: "var(--lime)" }}>
            <div className="n">03</div><h3>Memory</h3>
            <p>Season results are rolled into a Merkle root anchored on chain per token ID. The career follows the token, not the wallet, and shows up in what a buyer gets.</p>
          </div>
        </div>
        <div className="card" style={{ marginTop: 18 }}>
          <h3>The delete-the-NFT test</h3>
          <div className="tbl-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead><tr><th>Without a Chog</th><th>What happens</th></tr></thead>
              <tbody>
                <tr><td>Creature and genes</td><td className="wrapc">Nothing to decode. There is no character to put in the meadow.</td></tr>
                <tr><td>Daily nudge</td><td className="wrapc">Cannot be signed. Ownership of the token ID is the permission.</td></tr>
                <tr><td>Career and badges</td><td className="wrapc">Nowhere to live. The record is keyed by token ID, so it cannot exist without one.</td></tr>
                <tr><td>Spectating</td><td className="wrapc">Still free. Anyone can watch and replay, but cannot play. Watching is the funnel, owning is the game.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <div className="eyebrow">Three steps</div>
        <h2 style={{ margin: "8px 0 28px" }}>Connect. Wake. Watch and nudge.</h2>
        <div className="grid g3">
          <div className="card"><h3>1 · Connect</h3><p className="muted" style={{ marginTop: 8 }}>Link a wallet on Monad. Chogs you hold show up as cards. No wallet? Spectator mode is open to everyone.</p></div>
          <div className="card"><h3>2 · Wake</h3><p className="muted" style={{ marginTop: 8 }}>See how each trait became a gene. Your Chog joins the meadow and starts causing trouble on its own.</p></div>
          <div className="card"><h3>3 · Nudge</h3><p className="muted" style={{ marginTop: 8 }}>Pick Bold, Sneaky or Friendly once per day, signed with your wallet. It locks before the round and shifts the odds, never decides them.</p></div>
        </div>
      </section>

      {hot.length > 0 && (
        <section className="section wrap" style={{ paddingTop: 0 }}>
          <div className="sectionhead">
            <div><div className="eyebrow">Highlights</div><h2 style={{ marginTop: 8 }}>Moments worth sharing</h2></div>
          </div>
          <div className="grid g3">
            {hot.map((e) => (
              <Link href={`/event/${e.eventId}`} key={e.eventId} className="card card-hard" style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "center", gap: 6 }}><Sprite id={e.a.tokenId} size={80} /><Sprite id={e.b.tokenId} size={80} /></div>
                <b style={{ fontFamily: "var(--font-display)", textTransform: "uppercase" }}>{chogName(e.a.tokenId)} vs {chogName(e.b.tokenId)}</b>
                <span className="pill pill-orange" style={{ justifySelf: "start" }}>{EVENT_LABEL[e.type]}</span>
                <span className="muted">Replay with proof</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
