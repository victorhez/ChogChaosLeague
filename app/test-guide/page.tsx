import type { Metadata } from "next";
import Link from "next/link";
import { PageHead, Sprite } from "@/components/bits";
import { chogName } from "@/lib/chog";
import { loadLeague, recentRounds } from "@/lib/server/league";

export const metadata: Metadata = { title: "Testing guide" };
export const revalidate = 30;

const DEMO = [1, 7, 12, 23, 31, 42];

export default async function TestGuide() {
  const { state, roster, nudges } = await loadLeague();
  const [r] = await recentRounds(state.latestClosed, 1, roster, nudges);
  const ev = r.events[0];
  return (
    <div className="wrap prose" style={{ padding: "36px 0 72px", maxWidth: 900 }}>
      <PageHead eyebrow="For judges and testers" title="Test it in five minutes" />
      <p>No wallet and no NFT are needed to watch, replay and verify. A wallet unlocks the daily nudge.</p>

      <h2>Spectator path (no wallet)</h2>
      <ol>
        <li>Open the <Link href="/arena" style={{ textDecoration: "underline" }}>Arena</Link>. Tap a Chog in the meadow to see its genes and traits.</li>
        <li>Open any event in the feed, for example <Link href={`/event/${ev.eventId}`} style={{ textDecoration: "underline" }}>{ev.eventId}</Link>. Press <b>Replay</b>. The green banner confirms the browser reproduced the stored result.</li>
        <li>On the same page press <b>Check seed against Monad RPC</b> to compare the stored seed with the live block hash.</li>
        <li>Visit a Chog career page and look at the <b>Proof</b> column. Each season row verifies a Merkle proof in your browser.</li>
        <li>Open the <Link href="/leaderboard" style={{ textDecoration: "underline" }}>Leaderboard</Link>, switch seasons, and open the top moment.</li>
        <li>Share a highlight card to X from any event page.</li>
      </ol>

      <h2>Wallet path</h2>
      <ol>
        <li>Open <Link href="/play" style={{ textDecoration: "underline" }}>My Chogs</Link> and press <b>Connect wallet</b>. The app switches your wallet to Monad (chain 143).</li>
        <li>Until the collection address is configured, your wallet adopts three demo Chogs from its address. With the address set, Chogs you hold are read from the contract.</li>
        <li>Check the genome breakdown, choose Bold, Sneaky or Friendly, and press <b>Sign and lock nudge</b>. Signing is free: it is a message signature, not a transaction.</li>
        <li>Your nudge applies to rounds from the next unlocked round. Look for the &quot;nudged&quot; tag on later events.</li>
      </ol>

      <h2>Demo Chogs</h2>
      <div className="grid g3">
        {DEMO.map((id) => (
          <Link key={id} href={`/chog/${id}`} className="tile"><Sprite id={id} size={64} /><div><b>{chogName(id)}</b><small>token #{id}</small></div></Link>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 12 }}>Any token ID from 1 to 10000 works in spectator mode at <code>/chog/&lt;id&gt;</code>. IDs 1 to 48 play in the launch meadow.</p>

      <h2>Run the checks locally</h2>
      <pre className="code">{`npm install
npm test            # engine determinism, fairness bounds, replay, Merkle proofs
npm run typecheck
npm run dev`}</pre>

      <h2>What to expect</h2>
      <ul>
        <li>A new round closes about every hour (9,000 Monad blocks). Pages refresh within seconds of a round closing.</li>
        <li>If Monad's RPC is down, pages say so and rounds use a labelled fallback seed. The game never stops.</li>
        <li>Status page: <Link href="/status" style={{ textDecoration: "underline" }}>/status</Link>.</li>
      </ul>
    </div>
  );
}
