import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/bits";
import { WEIGHTS, STEPS, ROLL_RANGE, COUNTER_BONUS } from "@/lib/engine/engine";
import { GENES } from "@/lib/engine/types";
import { MAPPING_BASE, MAPPING_RARE, MAPPING_TABLE } from "@/lib/genome/genome";
import { ANCHOR_BLOCK, BLOCKS_PER_ROUND, FINALITY_BLOCKS, LOCK_BLOCKS, ROUNDS_PER_SEASON, REPO_URL } from "@/lib/config";

export const metadata: Metadata = { title: "Fairness" };

const VERIFY = `// Verify any event with nothing but Node 20+ and this repository.
//   git clone ${REPO_URL}.git && cd ChogChaosLeague && npm i
//   npx tsx scripts/verify.ts r250-e3
// The script fetches the seed block from Monad, rebuilds the round,
// re-runs the engine and compares the log hash.`;

export default function Fairness() {
  return (
    <div className="wrap prose" style={{ padding: "36px 0 72px", maxWidth: 940 }}>
      <PageHead eyebrow="Provably fair" title="Rules are code. Randomness is public." />

      <div className="grid g3" style={{ margin: "10px 0 8px" }}>
        <div className="card"><div className="eyebrow">Seed</div><p style={{ marginTop: 6 }}>Hash of Monad block <code>{ANCHOR_BLOCK.toLocaleString("en-US")} + round × {BLOCKS_PER_ROUND.toLocaleString("en-US")}</code>. Nobody can know it before the block exists.</p></div>
        <div className="card"><div className="eyebrow">Engine</div><p style={{ marginTop: 6 }}>One pure TypeScript module, shared by the server and your browser. No hidden randomness, no network calls.</p></div>
        <div className="card"><div className="eyebrow">Narration</div><p style={{ marginTop: 6 }}>Text only. It reads a finished result and can never change one. A template fallback runs if no model is available.</p></div>
      </div>

      <h2>How a round is decided</h2>
      <ol>
        <li><b>Clock.</b> Round <code>r</code> is seeded by block <code>{ANCHOR_BLOCK.toLocaleString("en-US")} + r × {BLOCKS_PER_ROUND.toLocaleString("en-US")}</code>. A round closes once that block is {FINALITY_BLOCKS} blocks behind head. The league clock is the chain, so there is no scheduler to trust.</li>
        <li><b>Lock before seed.</b> Nudges lock {LOCK_BLOCKS} blocks before the seed block is produced. Seed choice cannot be influenced by the nudges, and nudges cannot be chosen with knowledge of the seed.</li>
        <li><b>Pairing.</b> A seeded Fisher-Yates shuffle of the roster pairs Chogs and picks an event type.</li>
        <li><b>Power.</b> Power is the weighted sum of both Chogs' genes (table below), with the stance adjustment.</li>
        <li><b>Rolls.</b> {STEPS} steps. Each step adds a seeded roll of up to {ROLL_RANGE} (stretched for Bold, tightened for Friendly) plus a +{COUNTER_BONUS} counter bonus when a stance beats the other.</li>
        <li><b>Result.</b> Higher total wins. Points: winner 10 to 20, loser 3, upset bonus +5 when the winner's pre-roll power was lower by more than 4. Alliance Betrayal swaps the last step for a seeded betrayal draw.</li>
        <li><b>Log hash.</b> The inputs, steps and result are hashed with keccak256 and stored with the event.</li>
      </ol>
      <p>Stances form a triangle: <b>Bold</b> crushes <b>Friendly</b>, <b>Friendly</b> charms <b>Sneaky</b>, <b>Sneaky</b> ambushes <b>Bold</b>. Nudges shift weights. They never decide outcomes.</p>

      <h2>Event weights</h2>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Event</th>{GENES.map((g) => <th key={g}>{g}</th>)}</tr></thead>
          <tbody>
            {Object.entries(WEIGHTS).map(([t, w]) => (
              <tr key={t}><td>{t.replace("-", " ")}</td>{GENES.map((g) => <td key={g} className="mono">{w[g].toFixed(2)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>No weight is above 0.38, and the test suite asserts that. A common Chog beats a stronger one often enough to stay competitive.</p>

      <h2 id="genes">Trait to gene table</h2>
      <p>Every Chog starts at {MAPPING_BASE} in each gene. Each trait adds the deltas below. Rare values (★) get slightly bigger deltas, and each gene's trait bonus is capped, so rarity helps without deciding. Unknown trait values decode through a deterministic keccak-based fallback, so real collection metadata always yields the same genome.</p>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Trait</th><th>Value</th>{GENES.map((g) => <th key={g}>{g}</th>)}</tr></thead>
          <tbody>
            {Object.entries(MAPPING_TABLE).flatMap(([type, vals]) =>
              Object.entries(vals).map(([v, d]) => (
                <tr key={type + v}>
                  <td>{type}</td><td>{v}{MAPPING_RARE[type] === v ? " ★" : ""}</td>
                  {GENES.map((g) => <td key={g} className="mono">{d[g] ? (d[g]! > 0 ? `+${d[g]}` : d[g]) : "·"}</td>)}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <h2>Career on chain</h2>
      <p>For each season the app builds a Merkle tree of <code>(season, tokenId, points, wins, losses, bestStreak)</code> leaves and stores only the root in <b>ChaosLedger</b>. Contracts hold no NFTs and no funds. A profile's Verified badge re-checks its proof in your browser and compares the root with the contract. Seasons are {ROUNDS_PER_SEASON} rounds (one week).</p>

      <h2>Verify it yourself</h2>
      <pre className="code">{VERIFY}</pre>
      <p>Or press <b>Replay</b> on any <Link href="/arena" style={{ textDecoration: "underline" }}>event page</Link>. It re-runs the engine in your browser and compares log hashes. You can also ask Monad's RPC for the seed block hash from that page.</p>

      <h2>Honest limits</h2>
      <ul>
        <li>This build runs a launch meadow of 48 Chogs. The roster, wake-up registry and nudge book move to Postgres in production.</li>
        <li>Until the Chog team confirms the collection address and metadata URL, the app uses clearly labelled demo traits. Set <code>NEXT_PUBLIC_CHOG_CONTRACT</code> and real traits decode through the same table.</li>
        <li>If Monad's RPC is unreachable, rounds fall back to a public deterministic seed and every page says so.</li>
        <li>No wagering, no price or return promises, no pay-to-win.</li>
      </ul>
    </div>
  );
}
