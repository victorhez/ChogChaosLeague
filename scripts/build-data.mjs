// Builds the public trait-to-gene table and the name index from the real collection.
//   node scripts/fetch-collection.mjs   (once)
//   node scripts/build-data.mjs
// Output: lib/genome/mapping.json, lib/names.json
//
// Rules (also published on /fairness):
//  - Each trait category feeds specific genes. Major categories carry more weight, Accessory is a small
//    tie-break, Tier is a small all-round bonus, cosmetic categories barely matter.
//  - A value's delta scales with its rarity (less common value, a bit more), then gets a small
//    deterministic variation from keccak256(category:value), so ~300 values do not feel identical.
//  - Each gene's total trait bonus is capped, so no single trait can decide a match.
import { readFileSync, writeFileSync } from "node:fs";
import { keccak_256 } from "@noble/hashes/sha3";
import { utf8ToBytes } from "@noble/hashes/utils";

const GENES = ["mischief", "nerve", "wit", "speed", "charm"];
const col = JSON.parse(readFileSync(new URL("../data/collection.json", import.meta.url), "utf8"));
const ids = Object.keys(col).map(Number).sort((a, b) => a - b);

const CATS = {
  Aura: { w: { charm: 0.5, wit: 0.3, mischief: 0.2 }, M: 16 },
  Eyes: { w: { wit: 0.5, charm: 0.3, mischief: 0.2 }, M: 16 },
  Mouth: { w: { mischief: 0.5, charm: 0.3, wit: 0.2 }, M: 16 },
  Body: { w: { speed: 0.5, nerve: 0.5 }, M: 16 },
  Base: { w: { speed: 0.6, nerve: 0.4 }, M: 12 },
  Form: { w: { nerve: 0.5, speed: 0.3, mischief: 0.2 }, M: 14 },
  Head: { w: { nerve: 0.4, wit: 0.4, mischief: 0.2 }, M: 16 },
  Tier: { w: { mischief: 0.2, nerve: 0.2, wit: 0.2, speed: 0.2, charm: 0.2 }, M: 10 },
  Accessory: { w: "hash", M: 8 },
  Background: { w: "hash", M: 3 },
  Skin: { w: "hash", M: 3 },
  Naked: { w: "hash", M: 3 },
  Side: { w: "hash", M: 3 },
};

const h = (s) => keccak_256(utf8ToBytes(s));
const counts = {};
for (const id of ids) for (const [t, v] of Object.entries(col[id].a)) ((counts[t] ??= {})[v] = (counts[t][v] ?? 0) + 1);
console.log("categories:", Object.keys(counts).join(", "));
const unknownCats = Object.keys(counts).filter((c) => !CATS[c]);
if (unknownCats.length) console.log("NOTE: unmapped categories get the cosmetic rule:", unknownCats.join(", "));

const traits = {}, rare = {};
let values = 0;
for (const [type, vals] of Object.entries(counts)) {
  const cat = CATS[type] ?? { w: "hash", M: 3 };
  const total = Object.values(vals).reduce((a, b) => a + b, 0);
  traits[type] = {};
  rare[type] = [];
  for (const [value, n] of Object.entries(vals).sort()) {
    values++;
    const f = n / total;
    const r = Math.log(1 / f) / Math.log(total); // 0 = everyone has it, 1 = unique
    const scale = 0.4 + 0.6 * r;
    const hh = h(`${type}:${value}`);
    const variation = 0.2 + 1.6 * (hh[0] / 255);
    let weights = cat.w;
    if (weights === "hash") {
      const a = GENES[hh[1] % 5];
      let b = GENES[hh[2] % 5];
      if (b === a) b = GENES[(hh[2] + 1) % 5];
      weights = { [a]: 0.6, [b]: 0.4 };
    }
    const none = /^(none|no|nothing|n\/a|-)$/i.test(value);
    const delta = {};
    for (const [g, w] of Object.entries(weights)) {
      const d = none ? 0 : Math.round(cat.M * scale * w * variation);
      if (d) delta[g] = d;
    }
    // Hand-set rules for the collection's special tokens: the ten 1:1 Legendary Chogs carry only two traits,
    // so without a flat bonus they would be the weakest Chogs. Tier gives a small all-round lift.
    const flat = type === "Base" && value === "1:1" ? 14 : type === "Tier" && /legendary/i.test(value) ? 8 : type === "Tier" && /epic/i.test(value) ? 5 : 0;
    if (flat) for (const g of GENES) delta[g] = Math.max(delta[g] ?? 0, flat);
    traits[type][value] = delta;
    if (f < 0.005 && n >= 1) rare[type].push(value);
  }
}

const mapping = {
  version: 2,
  source: "Chog Genesis, 0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763 (Monad, 1,969 tokens)",
  base: 40,
  maxTraitBonusPerGene: 30,
  fallback: "A trait value not in this table decodes through a small deterministic delta from keccak256(type:value), so future metadata still works.",
  categories: Object.fromEntries(Object.entries(CATS).map(([k, c]) => [k, { genes: c.w === "hash" ? "tie-break (hash)" : Object.keys(c.w), weight: c.M }])),
  rare,
  traits,
};
writeFileSync(new URL("../lib/genome/mapping.json", import.meta.url), JSON.stringify(mapping, null, 1));

const names = [];
for (const id of ids) names[id] = col[id].n;
writeFileSync(new URL("../lib/names.json", import.meta.url), JSON.stringify(names));

// Distribution check
const gv = Object.fromEntries(GENES.map((g) => [g, []]));
for (const id of ids) {
  const bonus = Object.fromEntries(GENES.map((g) => [g, 0]));
  for (const [t, v] of Object.entries(col[id].a)) for (const [g, d] of Object.entries(traits[t]?.[v] ?? {})) bonus[g] += d;
  for (const g of GENES) gv[g].push(Math.min(100, Math.max(0, 40 + Math.min(30, bonus[g]))));
}
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
for (const g of GENES) console.log(g.padEnd(9), "mean", (gv[g].reduce((a, b) => a + b, 0) / gv[g].length).toFixed(1), "p5", q(gv[g], 0.05), "p50", q(gv[g], 0.5), "p95", q(gv[g], 0.95), "max", Math.max(...gv[g]));
console.log(`mapping.json: ${values} trait values across ${Object.keys(traits).length} categories; names.json: ${ids.length} tokens`);
