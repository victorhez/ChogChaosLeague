"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Arena, type ArenaPair } from "./Arena";
import { GeneBars, Sprite } from "./bits";
import type { Genome } from "@/lib/engine/types";

export interface DrawerChog {
  name: string;
  genome: Genome;
  traits: Record<string, string>;
  rank: number;
  points: number;
  wins: number;
  losses: number;
  streak: number;
}

export function ArenaLive({ pairs, chogs, label }: { pairs: ArenaPair[]; chogs: Record<number, DrawerChog>; label: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const close = useCallback(() => setSel(null), []);
  useEffect(() => {
    if (sel === null) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [sel, close]);
  const c = sel ? chogs[sel] : null;

  return (
    <>
      <Arena pairs={pairs} label={label} onSelect={setSel} />
      {sel && c && (
        <>
          <div className="drawer-bg" onClick={close} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${c.name} profile`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div className="eyebrow">Chog #{sel}</div>
              <button className="btn btn-ghost btn-sm" onClick={close} autoFocus>Close</button>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "14px 0" }}>
              <Sprite id={sel} size={96} alt={c.name} />
              <div>
                <h3>{c.name}</h3>
                <p className="muted">Rank #{c.rank} · {c.points} pts</p>
                <p className="muted">{c.wins}W {c.losses}L · streak {c.streak}</p>
              </div>
            </div>
            <GeneBars genome={c.genome} />
            <h3 style={{ margin: "18px 0 8px", fontSize: "1rem" }}>Traits to genes</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(c.traits).map(([k, v]) => <span className="pill" key={k}>{k}: {v}</span>)}
            </div>
            <Link className="btn btn-primary" style={{ marginTop: 20, width: "100%" }} href={`/chog/${sel}`}>Open full career</Link>
          </aside>
        </>
      )}
    </>
  );
}
