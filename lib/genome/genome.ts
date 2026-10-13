import { keccak_256 } from "@noble/hashes/sha3";
import { utf8ToBytes } from "@noble/hashes/utils";
import mapping from "./mapping.json";
import { GENES, type GeneKey, type Genome } from "../engine/types";

export type Traits = Record<string, string>;
export type Delta = Partial<Record<GeneKey, number>>;

type Table = Record<string, Record<string, Delta>>;
const TABLE = mapping.traits as Table;
const RARE = mapping.rare as Record<string, string[]>;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const norm = (s: string) => s.trim().toLowerCase();

const lookup = (() => {
  const m = new Map<string, Delta>();
  for (const [type, values] of Object.entries(TABLE)) {
    for (const [value, delta] of Object.entries(values)) m.set(`${norm(type)}:${norm(value)}`, delta);
  }
  return m;
})();

export const isKnownTrait = (type: string, value: string) => lookup.has(`${norm(type)}:${norm(value)}`);

function fallbackDelta(type: string, value: string): Delta {
  const h = keccak_256(utf8ToBytes(`${norm(type)}:${norm(value)}`));
  return { [GENES[h[0] % GENES.length]]: 3 + (h[1] % 4), [GENES[h[2] % GENES.length]]: 1 + (h[3] % 3) };
}

export function traitDelta(type: string, value: string): Delta {
  return lookup.get(`${norm(type)}:${norm(value)}`) ?? fallbackDelta(type, value);
}

/** Deterministic trait -> genome decoder. Same traits always give the same genome. */
export function decodeGenome(traits: Traits): Genome {
  const bonus: Genome = { mischief: 0, nerve: 0, wit: 0, speed: 0, charm: 0 };
  for (const [type, value] of Object.entries(traits)) {
    const delta = traitDelta(type, value);
    for (const g of GENES) bonus[g] += delta[g] ?? 0;
  }
  const g = {} as Genome;
  for (const k of GENES) g[k] = clamp(Math.round(mapping.base + clamp(bonus[k], -20, mapping.maxTraitBonusPerGene)), 0, 100);
  return g;
}

export const isRare = (type: string, value: string): boolean => RARE[type]?.includes(value) ?? false;

export const MAPPING_VERSION = mapping.version;
export const MAPPING_TABLE = TABLE;
export const MAPPING_BASE = mapping.base;
export const MAPPING_CAP = mapping.maxTraitBonusPerGene;
export const MAPPING_RARE = RARE;
export const MAPPING_CATEGORIES = (mapping as unknown as { categories: Record<string, { genes: string[] | string; weight: number }> }).categories;
export const MAPPING_SOURCE = (mapping as unknown as { source: string }).source;
