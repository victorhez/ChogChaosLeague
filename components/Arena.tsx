"use client";

import { useEffect, useRef, useState } from "react";
import type { Genome } from "@/lib/engine/types";
import type { EventType, Winner } from "@/lib/engine/types";
import { spriteCells, SPRITE_H, SPRITE_W } from "@/lib/sprite";
import { auraColor, chogName } from "@/lib/chog";

export interface ArenaPair {
  eventId: string;
  type: EventType;
  winner: Winner;
  betrayal: boolean;
  points: { a: number; b: number };
  a: { tokenId: number; genome: Genome; traits: Record<string, string> };
  b: { tokenId: number; genome: Genome; traits: Record<string, string> };
}

const W = 480, H = 270, S = 2, SZ = 46;
const BUBBLE: Record<EventType, string> = { "prank-heist": "PRANK!", "meme-duel": "ROAST!", "meadow-race": "GO GO!", "alliance-betrayal": "DEAL?" };
const PERIOD = 10;

function meadow(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) {
    g.fillStyle = (x / 8 + y / 8) % 2 ? "#2f9b57" : "#2b9052";
    g.fillRect(x, y, 8, 8);
  }
  for (let i = 0; i < 90; i++) { g.fillStyle = rnd() > 0.5 ? "#37aa63" : "#257a46"; g.fillRect(Math.floor(rnd() * W / 2) * 2, Math.floor(rnd() * H / 2) * 2, 2, 4); }
  // dirt path
  g.fillStyle = "#b98a54";
  for (let x = 0; x < W; x += 4) g.fillRect(x, 126 + Math.round(Math.sin(x / 40) * 6), 4, 22);
  g.fillStyle = "#a47745";
  for (let x = 0; x < W; x += 12) g.fillRect(x, 130 + Math.round(Math.sin(x / 40) * 6), 4, 2);
  // pond
  g.fillStyle = "#1b6fb5"; g.fillRect(380, 196, 76, 46); g.fillRect(372, 204, 8, 30); g.fillRect(456, 204, 8, 30);
  g.fillStyle = "#4fb4f5"; g.fillRect(388, 202, 20, 3); g.fillRect(420, 214, 24, 3);
  // flowers
  const colors = ["#ff5c8a", "#ffe14d", "#ffffff", "#836ef9", "#ff8a3d"];
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rnd() * W / 2) * 2, y = Math.floor(rnd() * H / 2) * 2;
    if (y > 120 && y < 152) continue;
    g.fillStyle = colors[i % colors.length]; g.fillRect(x, y, 2, 2);
    g.fillStyle = "#1c5a3a"; g.fillRect(x, y + 2, 2, 2);
  }
  // fence
  g.fillStyle = "#e9d8b4";
  for (let x = 6; x < W; x += 14) g.fillRect(x, 6, 4, 12);
  g.fillRect(0, 10, W, 3);
  return c;
}

/** Real Chog art (thumbnails of the NFT images), loaded lazily; the pixel creature shows while one loads. */
const artCache = new Map<number, HTMLImageElement>();
function realArt(id: number): HTMLImageElement | null {
  let img = artCache.get(id);
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/api/img/${id}?w=128`;
    artCache.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function drawArt(g: CanvasRenderingContext2D, who: ArenaPair["a"], x: number, y: number, hovered: boolean) {
  const art = realArt(who.tokenId);
  const r = 8;
  g.save();
  g.beginPath();
  g.roundRect(x, y, SZ, SZ, r);
  g.clip();
  if (art) g.drawImage(art, x, y, SZ, SZ);
  else { g.fillStyle = "#231846"; g.fillRect(x, y, SZ, SZ); g.imageSmoothingEnabled = false; g.drawImage(spriteCanvas(who), x + 3, y + 3, SZ - 6, SZ - 6); }
  g.restore();
  g.lineWidth = 3;
  g.strokeStyle = hovered ? "#ffffff" : auraColor(who.genome);
  g.beginPath(); g.roundRect(x, y, SZ, SZ, r); g.stroke();
}

const spriteCache = new Map<string, HTMLCanvasElement>();
function spriteCanvas(p: ArenaPair["a"]): HTMLCanvasElement {
  const key = String(p.tokenId);
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = SPRITE_W; c.height = SPRITE_H;
  const g = c.getContext("2d")!;
  for (const cell of spriteCells(p)) { g.fillStyle = cell.c; g.fillRect(cell.x, cell.y, 1, 1); }
  spriteCache.set(key, c);
  return c;
}

export function Arena({ pairs, label, onSelect }: { pairs: ArenaPair[]; label: string; onSelect?: (tokenId: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hover = useRef<number | null>(null);
  const spots = useRef<{ id: number; x: number; y: number }[]>([]);
  const [hoverName, setHoverName] = useState("");

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    const bg = meadow();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shown = pairs.slice(0, 8);
    let raf = 0;

    const frame = (ms: number) => {
      const t = ms / 1000;
      g.drawImage(bg, 0, 0);
      spots.current = [];
      shown.forEach((p, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const hx = 62 + col * 118, hy = 62 + row * 102;
        const local = reduce ? 0.9 : (((t + i * 1.3) % PERIOD) / PERIOD);
        const place = (side: -1 | 1, who: ArenaPair["a"], won: boolean, lost: boolean) => {
          const wob = reduce ? 0 : Math.sin(t * 1.4 + i * 2 + side) * 6;
          const wobY = reduce ? 0 : Math.cos(t * 1.1 + i + side * 2) * 4;
          let x = hx + side * 30 + wob, y = hy + wobY, dy = 0;
          let phaseBubble = "";
          if (local >= 0.45 && local < 0.6) { const k = (local - 0.45) / 0.15; x += (-side * 18) * k; }
          else if (local >= 0.6 && local < 0.8) {
            x += -side * 18 + (reduce ? 0 : Math.sin(t * 40) * 2);
            phaseBubble = p.betrayal && local > 0.72 ? "BETRAY!" : BUBBLE[p.type];
          } else if (local >= 0.8) {
            const k = (local - 0.8) / 0.2;
            x += -side * 18 * (1 - k);
            if (won) dy = -Math.abs(Math.sin(k * Math.PI * 3)) * 10;
          }
          g.save();
          g.globalAlpha = lost && local >= 0.8 ? 0.72 : 1;
          g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + 6, y + dy + SZ - 1, SZ - 12, 5);
          drawArt(g, who, x, y + dy, hover.current === who.tokenId);
          g.restore();
          spots.current.push({ id: who.tokenId, x: x + SZ / 2, y: y + dy + SZ / 2 });
          return { x, y: y + dy, phaseBubble };
        };
        const A = place(-1, p.a, p.winner === "a", p.winner === "b");
        const B = place(1, p.b, p.winner === "b", p.winner === "a");
        g.font = "bold 10px monospace"; g.textAlign = "center";
        if (A.phaseBubble) {
          const bx = hx, by = Math.min(A.y, B.y) - 8, w = g.measureText(A.phaseBubble).width + 12;
          g.fillStyle = "#fff"; g.fillRect(bx - w / 2, by - 12, w, 14);
          g.fillStyle = "#0e091c"; g.fillText(A.phaseBubble, bx, by - 1);
        }
        if (local >= 0.82) {
          g.font = "bold 11px monospace";
          [[A, p.points.a, p.winner === "a"], [B, p.points.b, p.winner === "b"]].forEach(([pos, pts, won]) => {
            const q = pos as typeof A;
            g.fillStyle = won ? "#ffe14d" : "#fff";
            g.fillText(`+${pts}`, q.x + SZ / 2, q.y - 4 - (local - 0.82) * 40);
          });
        }
      });
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const pick = (e: PointerEvent | MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      let best: number | null = null, bd = 28 * 28;
      for (const s of spots.current) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s.id; } }
      return best;
    };
    const move = (e: PointerEvent) => { const id = pick(e); hover.current = id; setHoverName(id ? `${chogName(id)} · #${id}` : ""); };
    const click = (e: MouseEvent) => { const id = pick(e); if (id && onSelect) onSelect(id); };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("click", click);
    if (reduce) { frame(0); const iv = setInterval(() => frame(0), 400); return () => { clearInterval(iv); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("click", click); }; }
    return () => { cancelAnimationFrame(raf); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("click", click); };
  }, [pairs, onSelect]);

  return (
    <div className="arena">
      <canvas ref={ref} width={W} height={H} role="img" aria-label={`Pixel meadow showing ${label}. Select a Chog to open its profile.`} />
      <div className="arena-hud">
        <span className="pill"><span className="dot" /> {label}</span>
        {hoverName && <span className="pill pill-orange">{hoverName}</span>}
      </div>
    </div>
  );
}
