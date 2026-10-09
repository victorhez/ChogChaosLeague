import { keccak_256 } from "@noble/hashes/sha3";
import { utf8ToBytes } from "@noble/hashes/utils";
import { auraColor, type Chog } from "./chog";

/** Procedural pixel Chog, drawn in the style of the league logo: spiky black hair, colored aura. */
export const SPRITE_W = 20;
export const SPRITE_H = 20;

export interface Cell { x: number; y: number; c: string }

const BLACK = "#0A0612";

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

const bytes = (s: string) => keccak_256(utf8ToBytes(s));

const cache = new Map<string, Cell[]>();

export function spriteCells(chog: Pick<Chog, "tokenId" | "traits" | "genome">): Cell[] {
  const key = `${chog.tokenId}:${chog.traits.Eyes ?? ""}:${chog.traits.Mouth ?? ""}:${auraColor(chog.genome)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const W = SPRITE_W, H = SPRITE_H;
  const aura = auraColor(chog.genome);
  const grid: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = c; };
  const body = new Set<string>();

  const hh = bytes(`hair:${chog.tokenId}:${chog.traits.Hair ?? ""}`);
  const faceIn = (x: number, y: number, rx: number, ry: number) => ((x - 9.5) / rx) ** 2 + ((y - 12) / ry) ** 2 <= 1;

  // aura/face fill, outline, hair
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (faceIn(x, y, 5.6, 5.4)) { set(x, y, aura); body.add(`${x},${y}`); }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!body.has(`${x},${y}`) && faceIn(x, y, 6.6, 6.4)) { set(x, y, BLACK); body.add(`${x},${y}`); }
  }
  for (let x = 3; x <= 16; x++) {
    const centre = 1 - Math.abs(x - 9.5) / 7;
    const spike = Math.round((hh[x % 32] % 4) * (0.5 + centre) + centre * 2);
    const top = 7 - spike;
    for (let y = Math.max(1, top); y <= 8; y++) {
      if (((x - 9.5) / 7) ** 2 + ((y - 8) / 9) ** 2 <= 1.15) { set(x, y, BLACK); body.add(`${x},${y}`); }
    }
  }

  // aura halo (jagged)
  const base = [...body];
  const halo = new Set<string>();
  for (const k of base) {
    const [x, y] = k.split(",").map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const kk = `${x + dx},${y + dy}`;
      if (!body.has(kk)) halo.add(kk);
    }
  }
  [...halo].forEach((k, i) => {
    const [x, y] = k.split(",").map(Number);
    set(x, y, aura);
    if (hh[(i * 7) % 32] % 5 < 2) {
      const dx = Math.sign(x - 9.5), dy = Math.sign(y - 11);
      set(x + dx, y + dy, aura);
    }
  });

  // features
  const eyeV = bytes(`eyes:${chog.traits.Eyes ?? chog.tokenId}`)[0] % 4;
  const mouthV = bytes(`mouth:${chog.traits.Mouth ?? chog.tokenId}`)[0] % 4;
  const blush = shade(aura, 0.72);
  set(6, 14, blush); set(13, 14, blush);
  const px = (cells: [number, number][], c = BLACK) => cells.forEach(([x, y]) => set(x, y, c));
  if (eyeV === 0) px([[7, 11], [7, 12], [12, 11], [12, 12]]);
  if (eyeV === 1) px([[7, 11], [7, 12], [12, 12], [13, 12], [11, 12]]);
  if (eyeV === 2) px([[6, 12], [7, 12], [8, 12], [11, 12], [12, 12], [13, 12]]);
  if (eyeV === 3) px([[7, 11], [8, 11], [7, 12], [8, 12], [11, 11], [12, 11], [11, 12], [12, 12]]);
  if (mouthV === 0) px([[8, 14], [11, 14], [9, 15], [10, 15]]);
  if (mouthV === 1) { px([[8, 14], [11, 14], [9, 15], [10, 15]]); px([[10, 16]], "#FF5C8A"); }
  if (mouthV === 2) px([[8, 15], [9, 15], [10, 15], [11, 15]]);
  if (mouthV === 3) px([[7, 14], [12, 14], [8, 15], [9, 15], [10, 15], [11, 15]]);

  const cells: Cell[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = grid[y][x]; if (c) cells.push({ x, y, c }); }
  cache.set(key, cells);
  return cells;
}

export function spriteSvg(chog: Pick<Chog, "tokenId" | "traits" | "genome">, size = 160): string {
  const rects = spriteCells(chog).map((c) => `<rect x="${c.x}" y="${c.y}" width="1" height="1" fill="${c.c}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${SPRITE_W} ${SPRITE_H}" shape-rendering="crispEdges">${rects}</svg>`;
}

export function spriteDataUri(chog: Pick<Chog, "tokenId" | "traits" | "genome">, size = 160): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(spriteSvg(chog, size))}`;
}
