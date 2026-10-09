import { keccak_256 } from "@noble/hashes/sha3";
import { utf8ToBytes } from "@noble/hashes/utils";
import mapping from "./mapping.json";
import { GENES, type GeneKey, type Genome } from "../engine/types";

export type Traits = Record<string, string>;

type Table = Record<string, Record<string, Partial<Record<GeneKey, number>>>>;
const TABLE = mapping.traits as Table;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const norm = (s: string) => s.trim().toLowerCase();

const lookup = (() => {
  const m = new Map<string, Partial<Record<GeneKey, number>>>();
  for (const [type, values] of Object.entries(TABLE)) {
    for (const [value, delta] of Object.entries(values)) m.set(`${norm(type)}:${norm(value)}`, delta);
  }
  return m;
})();

function fallbackDelta(type: string, value: string): Partial<Record<GeneKey, number>> {
  const h = keccak_256(utf8ToBytes(`${norm(type)}:${norm(value)}`));
  return { [GENES[h[0] % GENES.length]]: 4 + (h[1] % 5), [GENES[h[2] % GENES.length]]: 2 + (h[3] % 4) };
}

/** Deterministic trait -> genome decoder. Same traits always give the same genome. */
export function decodeGenome(traits: Traits): Genome {
  const bonus: Genome = { mischief: 0, nerve: 0, wit: 0, speed: 0, charm: 0 };
  for (const [type, value] of Object.entries(traits)) {
    const delta = lookup.get(`${norm(type)}:${norm(value)}`) ?? fallbackDelta(type, value);
    for (const g of GENES) bonus[g] += delta[g] ?? 0;
  }
  const g = {} as Genome;
  for (const k of GENES) g[k] = clamp(Math.round(mapping.base + clamp(bonus[k], -20, mapping.maxTraitBonusPerGene)), 0, 100);
  return g;
}

export function isRare(type: string, value: string): boolean {
  return (mapping.rare as Record<string, string>)[type] === value;
}

/** Synthetic traits for demo/spectator tokens (used until real metadata is available). Deterministic per token id. */
export function syntheticTraits(tokenId: number): Traits {
  const h = keccak_256(utf8ToBytes(`chog-demo:${tokenId}`));
  const out: Traits = {};
  Object.keys(TABLE).forEach((type, i) => {
    const values = Object.keys(TABLE[type]);
    const rare = (mapping.rare as Record<string, string>)[type];
    const common = values.filter((v) => v !== rare);
    out[type] = h[i * 2] % 20 === 0 ? rare : common[h[i * 2 + 1] % common.length];
  });
  return out;
}

export const MAPPING_VERSION = mapping.version;
export const MAPPING_TABLE = TABLE;
export const MAPPING_BASE = mapping.base;
export const MAPPING_RARE = mapping.rare as Record<string, string>;
