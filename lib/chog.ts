import { keccak_256 } from "@noble/hashes/sha3";
import { utf8ToBytes } from "@noble/hashes/utils";
import { decodeGenome, syntheticTraits, type Traits } from "./genome/genome";
import { GENES, type GeneKey, type Genome } from "./engine/types";

export interface Chog {
  tokenId: number;
  name: string;
  traits: Traits;
  genome: Genome;
  /** "demo" = synthetic traits, "chain" = read from the Chog collection. */
  source: "demo" | "chain";
}

export const GENE_COLOR: Record<GeneKey, string> = {
  mischief: "#A6FF00",
  nerve: "#FF3B3B",
  wit: "#00F5FF",
  speed: "#FF8A3D",
  charm: "#836EF9",
};

const FIRST = ["Bonk", "Zig", "Moop", "Snack", "Wobble", "Gizmo", "Plonk", "Fizz", "Noodle", "Biscuit", "Gremlin", "Pickle", "Mango", "Yeet", "Doodle", "Crumb"];
const LAST = ["the Unwise", "McGee", "Jr.", "Prime", "the Bold", "von Chaos", "of Meadow", "Supreme", "the Third", "Deluxe", "Zero", "Max", "the Sneaky", "Esq.", "9000", "Forever"];

export function chogName(tokenId: number): string {
  const h = keccak_256(utf8ToBytes(`name:${tokenId}`));
  return `${FIRST[h[0] % 16]} ${LAST[h[1] % 16]}`;
}

export function dominantGene(g: Genome): GeneKey {
  return GENES.reduce((best, k) => (g[k] > g[best] ? k : best), GENES[0]);
}

export const auraColor = (g: Genome) => GENE_COLOR[dominantGene(g)];

export function demoChog(tokenId: number): Chog {
  const traits = syntheticTraits(tokenId);
  return { tokenId, name: chogName(tokenId), traits, genome: decodeGenome(traits), source: "demo" };
}

export function chogFromTraits(tokenId: number, traits: Traits, source: Chog["source"]): Chog {
  return { tokenId, name: chogName(tokenId), traits, genome: decodeGenome(traits), source };
}
