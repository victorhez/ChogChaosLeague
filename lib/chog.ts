import { decodeGenome, type Traits } from "./genome/genome";
import { GENES, type GeneKey, type Genome } from "./engine/types";
import names from "./names.json";

export interface Chog {
  tokenId: number;
  /** Display name from the token metadata, for example "CHOG #541". Its number is not the token id. */
  name: string;
  traits: Traits;
  genome: Genome;
}

export const GENE_COLOR: Record<GeneKey, string> = {
  mischief: "#A6FF00",
  nerve: "#FF3B3B",
  wit: "#00F5FF",
  speed: "#FF8A3D",
  charm: "#836EF9",
};

/** Real metadata name for a token id. */
export function chogName(tokenId: number): string {
  return (names as (string | null)[])[tokenId] ?? `CHOG token ${tokenId}`;
}

export function dominantGene(g: Genome): GeneKey {
  return GENES.reduce((best, k) => (g[k] > g[best] ? k : best), GENES[0]);
}

export const auraColor = (g: Genome) => GENE_COLOR[dominantGene(g)];

export function chogFrom(tokenId: number, traits: Traits): Chog {
  return { tokenId, name: chogName(tokenId), traits, genome: decodeGenome(traits) };
}
