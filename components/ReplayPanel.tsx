"use client";

import { useEffect, useMemo, useState } from "react";
import { runEvent } from "@/lib/engine/engine";
import type { EngineInput, EngineResult, EventType, Genome, Stance } from "@/lib/engine/types";
import { narrate } from "@/lib/narration";
import { chogName } from "@/lib/chog";
import { publicClient } from "@/lib/chain";
import { CHAIN } from "@/lib/config";

export interface ReplayData {
  eventId: string;
  type: EventType;
  seedHash: string;
  seedBlock: number;
  seedSource: "monad" | "fallback";
  a: { tokenId: number; genome: Genome; stance: Stance };
  b: { tokenId: number; genome: Genome; stance: Stance };
  stored: EngineResult;
}

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

export function ReplayPanel({ data }: { data: ReplayData }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [seedCheck, setSeedCheck] = useState<"idle" | "checking" | "match" | "mismatch" | "error">("idle");
  const [shown, setShown] = useState(data.stored.log.length);

  const input: EngineInput = useMemo(
    () => ({ type: data.type, seedHash: data.seedHash, eventId: data.eventId, a: data.a, b: data.b }),
    [data],
  );
  const names = { a: chogName(data.a.tokenId), b: chogName(data.b.tokenId) };
  const nar = useMemo(() => narrate(input, data.stored, names), [input, data.stored, names.a, names.b]); // eslint-disable-line react-hooks/exhaustive-deps

  const replayed = useMemo(() => (state === "idle" ? null : runEvent(input)), [state, input]);
  const same = replayed ? replayed.logHash === data.stored.logHash && replayed.winner === data.stored.winner : null;

  useEffect(() => {
    if (state !== "running") return;
    setShown(0);
    const total = data.stored.log.length;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(i);
      if (i >= total) { clearInterval(t); setState("done"); }
    }, 650);
    return () => clearInterval(t);
  }, [state, data.stored.log.length]);

  async function verifySeed() {
    setSeedCheck("checking");
    try {
      const block = await publicClient.getBlock({ blockNumber: BigInt(data.seedBlock) });
      setSeedCheck(block.hash?.toLowerCase() === data.seedHash.toLowerCase() ? "match" : "mismatch");
    } catch {
      setSeedCheck("error");
    }
  }

  const r = data.stored;
  const winnerName = r.winner === "a" ? names.a : r.winner === "b" ? names.b : "Nobody";
  const tot = r.totalA + r.totalB || 1;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card card-hard">
        <div className="eyebrow">Chog Chronicle</div>
        <p style={{ fontSize: "1.25rem", margin: "8px 0 16px", fontWeight: 600 }}>{nar.headline}</p>
        {r.winner !== "draw" && data.type !== "alliance-betrayal" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }} className="muted">
              <span>{names.a} · {r.totalA.toFixed(1)}</span><span>{r.totalB.toFixed(1)} · {names.b}</span>
            </div>
            <div className="scorebar" aria-hidden><i style={{ width: `${(r.totalA / tot) * 100}%`, background: "var(--purple)" }} /><i style={{ width: `${(r.totalB / tot) * 100}%`, background: "var(--orange)" }} /></div>
          </>
        )}
        <p className="muted" style={{ marginTop: 12 }}>
          Winner: <b style={{ color: "var(--cloud)" }}>{winnerName}</b> · Points {r.points.a} / {r.points.b}
          {r.upset ? " · Upset bonus +5" : ""}
        </p>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div>
            <h3>Verify this result</h3>
            <p className="muted">Re-runs the exact engine in your browser from the stored inputs and seed.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setState("running")} disabled={state === "running"}>
            {state === "idle" ? "▶ Replay" : state === "running" ? "Replaying…" : "↻ Replay again"}
          </button>
        </div>

        <div className="replay-steps" style={{ marginTop: 18 }} aria-live="polite">
          {nar.lines.slice(0, 1).map((l, i) => <div className="step" key={`o${i}`}>{l}</div>)}
          {data.stored.log.slice(0, shown).map((s, i) => (
            <div className="step" key={`${state}-${s.n}`} style={{ animationDelay: state === "running" ? "0s" : `${i * 0.08}s` }}>
              {nar.lines[i + 1]}
              <div className="mono muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                {s.betrayA !== undefined
                  ? `draws ${s.rollA} / ${s.rollB} · betray A:${s.betrayA ? "yes" : "no"} B:${s.betrayB ? "yes" : "no"}`
                  : `roll ${s.rollA} / ${s.rollB} → ${s.scoreA} vs ${s.scoreB}`}
              </div>
            </div>
          ))}
        </div>

        {replayed && state !== "running" && (
          <div className={`verdict ${same ? "ok" : "bad"}`} style={{ marginTop: 16 }} role="status">
            <span aria-hidden>{same ? "✔" : "✖"}</span>
            {same ? "Identical. Replay hash matches the stored log hash." : "Mismatch. The replay differs from the stored result."}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Inputs and seed</h3>
        <div className="tbl-wrap" style={{ marginTop: 14 }}>
          <table>
            <tbody>
              <tr><th>Event</th><td className="mono">{data.eventId} · {data.type}</td></tr>
              <tr><th>Seed block</th><td className="mono"><a href={`${CHAIN.explorer}/block/${data.seedBlock}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>#{data.seedBlock.toLocaleString()}</a> · {data.seedSource === "monad" ? "Monad mainnet" : "public fallback seed (RPC unreachable)"}</td></tr>
              <tr><th>Seed hash</th><td className="mono">{short(data.seedHash)}</td></tr>
              <tr><th>Log hash</th><td className="mono">{short(data.stored.logHash)}</td></tr>
              <tr><th>{names.a}</th><td className="mono">#{data.a.tokenId} · {data.a.stance} · {JSON.stringify(data.a.genome)}</td></tr>
              <tr><th>{names.b}</th><td className="mono">#{data.b.tokenId} · {data.b.stance} · {JSON.stringify(data.b.genome)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={verifySeed} disabled={seedCheck === "checking" || data.seedSource !== "monad"}>
            {seedCheck === "checking" ? "Asking Monad…" : "Check seed against Monad RPC"}
          </button>
          {seedCheck === "match" && <span className="pill pill-mint">✔ Block hash matches Monad</span>}
          {seedCheck === "mismatch" && <span className="pill pill-orange">Hash differs from RPC</span>}
          {seedCheck === "error" && <span className="pill pill-muted">RPC unreachable from this browser</span>}
        </div>
      </div>
    </div>
  );
}
