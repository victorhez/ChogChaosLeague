import type { Metadata } from "next";
import Link from "next/link";
import { ChogImage, PageHead } from "@/components/bits";
import { chogName } from "@/lib/chog";
import { COLLECTION_SIZE, CHOG_CONTRACT, LIVE_FROM_ROUND, isHistory } from "@/lib/config";
import { loadLeague, recentRounds } from "@/lib/server/league";

export const metadata: Metadata = { title: "Testing guide" };
export const dynamic = "force-dynamic";

const SAMPLE = [1, 7, 541, 1049, 1557, 1969];

export default async function TestGuide() {
  const { state, roster, nudges } = await loadLeague();
  const [r] = await recentRounds(state.latestClosed, 1, roster, nudges);
  const ev = r.events[0];
  const live = state.liveRoundsClosed > 0;
  return (
    <div className="wrap prose" style={{ padding: "36px 0 72px", maxWidth: 900 }}>
      <PageHead eyebrow="For judges and testers" title="Test it in five minutes" />
      <p>There are three ways in. Watching and replaying need no wallet. Playing (setting a nudge) needs a Chog Genesis token in the connected wallet; a wallet without one is told so and cannot nudge any Chog.</p>
      <p className="muted">All {COLLECTION_SIZE.toLocaleString("en-US")} Chogs from <a href={`https://monadscan.com/address/${CHOG_CONTRACT}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>the Chog Genesis contract</a> play. Rounds before #{LIVE_FROM_ROUND} are replayed history (see the fairness page); {live ? `${state.liveRoundsClosed} live rounds have closed so far.` : "the first live round closes within the hour of launch."}</p>

      <h2>1 · Spectator (no wallet)</h2>
      <ol>
        <li>Open the <Link href="/arena" style={{ textDecoration: "underline" }}>Arena</Link>. Tap a Chog in the meadow for its genes and traits.</li>
        <li>Open an event, for example <Link href={`/event/${ev.eventId}`} style={{ textDecoration: "underline" }}>{ev.eventId}</Link>{isHistory(ev.roundId) ? " (replayed history)" : ""}. Press <b>Replay</b>. The green banner confirms your browser reproduced the stored result.</li>
        <li>On the same page press <b>Check seed against Monad RPC</b> to compare the stored seed with the live block hash.</li>
        <li>Open any Chog page (links below) and check the <b>Proof</b> column. Each season row verifies a Merkle proof in your browser.</li>
        <li>Open the <Link href="/leaderboard" style={{ textDecoration: "underline" }}>Leaderboard</Link>, switch seasons, open the top moment, and share a highlight card to X.</li>
      </ol>

      <h2>2 · Sandbox (no wallet, no points)</h2>
      <p>The <Link href="/sandbox" style={{ textDecoration: "underline" }}>Sandbox</Link> lets anyone pit two Chogs against each other with chosen stances and a seed word. It is practice only: nothing is stored, and it never touches the leaderboard, badges or prizes.</p>

      <h2>3 · Holder (wallet with a Chog)</h2>
      <ol>
        <li>Open <Link href="/play" style={{ textDecoration: "underline" }}>My Chogs</Link> and press <b>Connect wallet</b>. The app switches your wallet to Monad (chain 143).</li>
        <li>Your Chogs appear with real art, read live from the contract. Check the genome breakdown.</li>
        <li>Choose Bold, Sneaky or Friendly and press <b>Sign and lock nudge</b>. Signing is free (a message, not a transaction). The server verifies the signature and calls <code>ownerOf</code> on Monad before recording it.</li>
        <li>Your nudge applies from the next unlocked round. Look for the &quot;nudged&quot; tag on later events of that Chog.</li>
      </ol>

      <h2>4 · The delete-the-NFT test</h2>
      <p>Connect a wallet that holds <b>no</b> Chog. <Link href="/play" style={{ textDecoration: "underline" }}>My Chogs</Link> says &quot;You need a Chog to play&quot; and offers spectating, the Sandbox, or finding a Chog. The nudge API rejects any signature from a wallet that is not the on-chain owner (covered by an automated test).</p>

      <h2>Wallet paths and how each was tested</h2>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Path</th><th>Expected result</th><th>How it is checked</th></tr></thead>
          <tbody>
            <tr><td>Holder nudges a Chog they own</td><td className="wrapc">Signature verified, <code>ownerOf</code> on Monad matches, nudge recorded (200). A second nudge for the same Chog that day gets 409.</td><td className="wrapc">Automated test with an injected owner. Live check needs a real holder wallet (command below).</td></tr>
            <tr><td>Non-holder signs a nudge for someone else&apos;s Chog</td><td className="wrapc">Rejected with 403 &quot;This wallet does not own that Chog.&quot; Nothing is stored.</td><td className="wrapc">Automated test and live end-to-end script.</td></tr>
            <tr><td>Wallet with no Chog opens My Chogs</td><td className="wrapc">&quot;You need a Chog to play&quot;; no Chogs are listed.</td><td className="wrapc">Live script (<code>/api/owned</code>) and screen recording.</td></tr>
            <tr><td>Forged, expired or stale-day signature; token outside the collection</td><td className="wrapc">401, 401, 409 and 404 respectively.</td><td className="wrapc">Automated tests and live end-to-end script.</td></tr>
            <tr><td>Sandbox</td><td className="wrapc">Works without a wallet, uses the read-only Chog endpoint, stores nothing, and never touches the leaderboard, badges or season points.</td><td className="wrapc">Live script and code review (no write calls).</td></tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>Run the live checks yourself:</p>
      <pre className="code">{`node scripts/test-wallet-paths.mjs
# optional holder path (records ONE real nudge for a Chog that wallet owns):
HOLDER_PRIVATE_KEY=0x... node scripts/test-wallet-paths.mjs`}</pre>

      <h2>Sample Chogs</h2>
      <div className="grid g3">
        {SAMPLE.map((id) => (
          <Link key={id} href={`/chog/${id}`} className="tile"><ChogImage id={id} size={64} /><div><b>{chogName(id)}</b><small>token #{id}</small></div></Link>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 12 }}>Valid token ids are 1 to {COLLECTION_SIZE}, at <code>/chog/&lt;id&gt;</code>. Names come from the metadata and their numbers can differ from the token id.</p>

      <h2>Run the checks locally</h2>
      <pre className="code">{`npm install
npm test            # engine, fairness bounds, replay, Merkle proofs, real-trait coverage, nudge ownership
npm run typecheck
npm run verify -- r168-e3   # re-run any event from public data`}</pre>

      <h2>What to expect</h2>
      <ul>
        <li>A round closes about every hour (9,000 Monad blocks). Pages refresh within seconds of a round closing.</li>
        <li>If Monad&apos;s RPC is down, pages say so and rounds use a labelled fallback seed. The game never stops.</li>
        <li>Status: <Link href="/status" style={{ textDecoration: "underline" }}>/status</Link>.</li>
      </ul>
    </div>
  );
}
