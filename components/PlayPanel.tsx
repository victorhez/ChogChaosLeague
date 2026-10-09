"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { demoChog, type Chog } from "@/lib/chog";
import { fetchChog } from "@/lib/chain";
import { GeneBars, Sprite } from "./bits";
import { STANCES, type Stance } from "@/lib/engine/types";
import { STANCE_INFO, nudgeMessage } from "@/lib/nudge-shared";
import { MAPPING_TABLE } from "@/lib/genome/genome";

interface Win { fromRound: number; day: number; locksInSeconds: number; open: boolean }
interface Nudge { stance: Stance }

function useCountdown(seconds: number | undefined) {
  const [s, setS] = useState(seconds ?? 0);
  useEffect(() => { setS(seconds ?? 0); }, [seconds]);
  useEffect(() => { const t = setInterval(() => setS((v) => Math.max(0, v - 1)), 1000); return () => clearInterval(t); }, []);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export function PlayPanel() {
  const w = useWallet();
  const [chogs, setChogs] = useState<Chog[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [win, setWin] = useState<Win | null>(null);
  const [current, setCurrent] = useState<Nudge | null>(null);
  const [pick, setPick] = useState<Stance>("sneaky");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const countdown = useCountdown(win?.locksInSeconds);

  useEffect(() => {
    let live = true;
    (async () => {
      const list = await Promise.all(w.myChogs.map((id) => (w.mode === "chain" ? fetchChog(id) : Promise.resolve(demoChog(id)))));
      if (!live) return;
      setChogs(list);
      setSel((s) => s ?? list[0]?.tokenId ?? null);
    })();
    return () => { live = false; };
  }, [w.myChogs, w.mode]);

  const refresh = useCallback(async () => {
    if (!sel) return;
    const r = await fetch(`/api/nudge?token=${sel}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r) { setWin(r.window); setCurrent(r.nudge); }
  }, [sel]);
  useEffect(() => { void refresh(); }, [refresh]);

  const chog = useMemo(() => chogs.find((c) => c.tokenId === sel) ?? null, [chogs, sel]);

  async function submit() {
    if (!sel || !win || !w.address) return;
    setBusy(true); setMsg(null);
    try {
      const signature = await w.sign(nudgeMessage(sel, win.day, pick));
      const res = await fetch("/api/nudge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId: sel, stance: pick, owner: w.address, day: win.day, signature }) });
      const j = await res.json();
      if (!res.ok) setMsg({ ok: false, text: j.error ?? "Could not record the nudge." });
      else { setMsg({ ok: true, text: "Nudge signed and locked in for today." }); await refresh(); }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message?.slice(0, 140) || "Signature cancelled." });
    } finally { setBusy(false); }
  }

  if (!w.address) {
    return (
      <div className="card card-hard" style={{ textAlign: "center", padding: 36 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}><Sprite id={3} size={84} /><Sprite id={11} size={84} /><Sprite id={29} size={84} /></div>
        <h2 style={{ margin: "14px 0 10px" }}>Step 1 · Connect</h2>
        <p className="muted" style={{ maxWidth: 520, margin: "0 auto 20px" }}>
          Connect a wallet on Monad to wake your Chog. {w.mode === "demo" ? "While the Chog collection address is being confirmed, your wallet adopts three demo Chogs so you can try the whole flow." : "Chogs held by your wallet appear as cards."}
        </p>
        <button className="btn btn-primary" onClick={w.connect} disabled={w.connecting}>{w.connecting ? "Connecting…" : "Connect wallet"}</button>
        {w.error && <p className="notice" style={{ marginTop: 16 }}>{w.error}</p>}
        <p className="muted" style={{ marginTop: 22 }}>No wallet? <Link href="/arena" style={{ textDecoration: "underline" }}>Spectate the meadow</Link> or <Link href="/test-guide" style={{ textDecoration: "underline" }}>use the demo Chogs</Link>.</p>
      </div>
    );
  }

  if (!chogs.length) {
    return <div className="card"><h3>No Chog found</h3><p className="muted" style={{ marginTop: 8 }}>This wallet does not hold a Chog. You can still <Link href="/arena" style={{ textDecoration: "underline" }}>spectate</Link> any Chog by token ID.</p></div>;
  }

  return (
    <div className="grid" style={{ gap: 22 }}>
      {w.mode === "demo" && <div className="notice">Demo mode: your wallet adopted these Chogs deterministically from its address. Once the collection address is set, this list is read from the Chog contract on Monad.</div>}
      <div className="grid g3">
        {chogs.map((c) => (
          <button key={c.tokenId} className="tile" onClick={() => setSel(c.tokenId)} aria-pressed={sel === c.tokenId} style={{ cursor: "pointer", textAlign: "left", color: "inherit", borderColor: sel === c.tokenId ? "var(--orange)" : undefined, font: "inherit" }}>
            <Sprite id={c.tokenId} size={64} alt="" />
            <div><b>{c.name}</b><small>#{c.tokenId}</small></div>
          </button>
        ))}
      </div>

      {chog && (
        <div className="grid g2">
          <div className="card">
            <div className="eyebrow">Step 2 · Wake</div>
            <h3 style={{ margin: "6px 0 14px" }}>{chog.name}&apos;s genome</h3>
            <GeneBars genome={chog.genome} />
            <h3 style={{ fontSize: "1rem", margin: "18px 0 8px" }}>How its traits decoded</h3>
            <div className="tbl-wrap"><table><tbody>
              {Object.entries(chog.traits).map(([k, v]) => {
                const d = MAPPING_TABLE[k]?.[v] ?? {};
                return <tr key={k}><td>{k}</td><td>{v}</td><td className="mono muted">{Object.entries(d).map(([g, n]) => `${g} ${n! > 0 ? "+" : ""}${n}`).join(", ") || "·"}</td></tr>;
              })}
            </tbody></table></div>
            <Link href={`/chog/${chog.tokenId}`} className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>Open career</Link>
          </div>

          <div className="card card-hard">
            <div className="eyebrow">Step 3 · Nudge</div>
            <h3 style={{ margin: "6px 0 6px" }}>Today&apos;s stance</h3>
            <p className="muted">One nudge per Chog per day. It locks before the round and shifts the odds, never decides them.</p>
            <p className="mono" style={{ margin: "12px 0", color: "var(--orange)" }}>{win?.open ? `Locks in ${countdown}` : "Round locked · counts from the next round"}</p>

            {current ? (
              <div className="verdict ok" role="status">✔ Locked in: <b style={{ textTransform: "capitalize" }}>{current.stance}</b> for today</div>
            ) : (
              <>
                <div className="stance" role="group" aria-label="Stance">
                  {STANCES.map((s) => (
                    <button key={s} aria-pressed={pick === s} onClick={() => setPick(s)}>
                      <b>{STANCE_INFO[s].label}</b><small>{STANCE_INFO[s].blurb}</small><br /><small>{STANCE_INFO[s].beats}</small>
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={submit} disabled={busy || !win}>{busy ? "Waiting for signature…" : "Sign and lock nudge"}</button>
              </>
            )}
            {msg && <p className={`verdict ${msg.ok ? "ok" : "bad"}`} style={{ marginTop: 12 }} role="status">{msg.text}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
