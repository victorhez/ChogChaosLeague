"use client";

import { useState } from "react";
import { runEvent } from "@/lib/engine/engine";
import { keccakHex } from "@/lib/engine/prng";
import { EVENT_TYPES, STANCES, type EngineResult, type EventType, type Genome, type Stance } from "@/lib/engine/types";
import { narrate } from "@/lib/narration";
import { ChogImage, EVENT_LABEL, GeneBars, OUTCOME_LABEL } from "./bits";

interface Loaded { tokenId: number; name: string; genome: Genome }

async function load(id: number): Promise<Loaded> {
  const r = await fetch(`/api/chog/${id}`);
  if (!r.ok) throw new Error(`Token ${id} is not in the collection (1 to 1969).`);
  return r.json();
}

export function SandboxPanel() {
  const [a, setA] = useState(1), [b, setB] = useState(2);
  const [sa, setSa] = useState<Stance>("bold"), [sb, setSb] = useState<Stance>("sneaky");
  const [type, setType] = useState<EventType>("meme-duel");
  const [word, setWord] = useState("sandbox");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [out, setOut] = useState<{ A: Loaded; B: Loaded; res: EngineResult; headline: string; lines: string[] } | null>(null);

  async function run() {
    setBusy(true); setErr("");
    try {
      const [A, B] = await Promise.all([load(a), load(b)]);
      if (A.tokenId === B.tokenId) throw new Error("Pick two different Chogs.");
      const seedHash = keccakHex(`sandbox:${word}`);
      const input = { type, seedHash, eventId: "sandbox", a: { tokenId: A.tokenId, genome: A.genome, stance: sa }, b: { tokenId: B.tokenId, genome: B.genome, stance: sb } };
      const res = runEvent(input);
      const nar = narrate(input, res, { a: A.name, b: B.name });
      setOut({ A, B, res, headline: nar.headline, lines: nar.lines });
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  const field = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--night-2)", color: "var(--cloud)", font: "inherit", width: "100%" } as const;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="notice"><b>Sandbox.</b> Practice with any two Chogs. Results here are never stored: no season points, no badges, no leaderboard, no prizes. The real league only counts holders&apos; nudges.</div>
      <div className="card">
        <div className="grid g2">
          <label>Chog A token id<input style={field} type="number" min={1} max={1969} value={a} onChange={(e) => setA(Number(e.target.value))} /></label>
          <label>Chog B token id<input style={field} type="number" min={1} max={1969} value={b} onChange={(e) => setB(Number(e.target.value))} /></label>
          <label>A stance<select style={field} value={sa} onChange={(e) => setSa(e.target.value as Stance)}>{STANCES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>B stance<select style={field} value={sb} onChange={(e) => setSb(e.target.value as Stance)}>{STANCES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Event<select style={field} value={type} onChange={(e) => setType(e.target.value as EventType)}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}</select></label>
          <label>Seed word (changes the dice)<input style={field} value={word} onChange={(e) => setWord(e.target.value)} /></label>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={run} disabled={busy}>{busy ? "Running…" : "Run sandbox event"}</button>
        {err && <p className="verdict bad" style={{ marginTop: 12 }}>{err}</p>}
      </div>

      {out && (
        <div className="grid g2">
          {[out.A, out.B].map((c, i) => (
            <div className="card" key={c.tokenId}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
                <ChogImage id={c.tokenId} size={72} alt={c.name} />
                <div><h3>{c.name}</h3><p className="muted mono">token #{c.tokenId}{(out.res.winner === "a" && i === 0) || (out.res.winner === "b" && i === 1) ? " · winner" : ""}</p></div>
              </div>
              <GeneBars genome={c.genome} />
            </div>
          ))}
          <div className="card card-hard" style={{ gridColumn: "1 / -1" }}>
            <div className="eyebrow">{EVENT_LABEL[type]} · {OUTCOME_LABEL[out.res.outcome]}</div>
            <p style={{ fontSize: "1.2rem", fontWeight: 600, margin: "8px 0 12px" }}>{out.headline}</p>
            <ul className="muted">{out.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            <p className="mono muted" style={{ marginTop: 10, fontSize: ".8rem" }}>log hash {out.res.logHash.slice(0, 18)}… · identical every time for the same inputs</p>
          </div>
        </div>
      )}
    </div>
  );
}
