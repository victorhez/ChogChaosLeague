import type { Metadata } from "next";
import { PageHead } from "@/components/bits";
import { CHOG_CONTRACT, COLLECTION_SIZE, LEDGER_ADDRESS, LIVE_FROM_ROUND } from "@/lib/config";
import { getHead, getRoster, getSeeds, leagueState } from "@/lib/server/league";
import { nudgeStoreHealth } from "@/lib/server/nudges";

export const metadata: Metadata = { title: "Status" };
export const dynamic = "force-dynamic";

export default async function Status() {
  const t0 = Date.now();
  const head = await getHead();
  const st = leagueState(head);
  const seed = (await getSeeds([st.latestClosed])).get(st.latestClosed);
  const roster = await getRoster();
  const store = await nudgeStoreHealth();
  const rows: [string, string, boolean][] = [
    ["Monad RPC", head.ok ? `up · head block ${head.latest.toLocaleString("en-US")}` : "unreachable · running on fallback seeds", head.ok],
    ["Latest closed round", `${st.latestClosed} (season ${st.season})`, true],
    ["Last seed", seed ? `${seed.hash.slice(0, 18)}… · block ${seed.block.toLocaleString("en-US")} · read from Monad` : "latest seed not retrieved yet (no placeholder is ever used)", Boolean(seed)],
    ["Next nudge lock", `${Math.round(st.secondsToLock / 60)} min`, true],
    ["Roster", `${roster.length} of ${COLLECTION_SIZE} Chogs · read from the Chog Genesis metadata (${CHOG_CONTRACT.slice(0, 10)}…)`, roster.length === COLLECTION_SIZE],
    ["League phase", st.latestClosed < LIVE_FROM_ROUND ? "replaying history · first live round pending" : `live · ${st.liveRoundsClosed} live rounds closed`, true],
    ["ChaosLedger", LEDGER_ADDRESS || "not deployed in this environment", Boolean(LEDGER_ADDRESS)],
    ["Nudge store", store.label, store.durable],
    ["Page latency", `${Date.now() - t0} ms`, true],
  ];
  return (
    <div className="wrap" style={{ padding: "36px 0 72px", maxWidth: 820 }}>
      <PageHead eyebrow="Health" title="System status" />
      <div className="grid">
        {rows.map(([k, v, ok]) => (
          <div className="card" key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: 18 }}>
            <b>{k}</b>
            <span className={`pill ${ok ? "pill-mint" : "pill-orange"}`}>{v}</span>
          </div>
        ))}
      </div>
      <p className="muted mono" style={{ marginTop: 16 }}>JSON: /api/health · /api/league</p>
    </div>
  );
}
