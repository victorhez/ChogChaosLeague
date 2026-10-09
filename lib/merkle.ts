import { concat, encodePacked, keccak256, type Hex } from "viem";

/** Leaf layout mirrors ChaosLedger.leafOf(): keccak256(abi.encodePacked(uint256 x6)). */
export interface LeafData {
  seasonId: number;
  tokenId: number;
  points: number;
  wins: number;
  losses: number;
  bestStreak: number;
}

export function leafHash(l: LeafData): Hex {
  return keccak256(
    encodePacked(
      ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [BigInt(l.seasonId), BigInt(l.tokenId), BigInt(l.points), BigInt(l.wins), BigInt(l.losses), BigInt(l.bestStreak)],
    ),
  );
}

/** Commutative pair hash (smaller first), same as OpenZeppelin MerkleProof. */
export function hashPair(a: Hex, b: Hex): Hex {
  return BigInt(a) <= BigInt(b) ? keccak256(concat([a, b])) : keccak256(concat([b, a]));
}

export interface MerkleTree {
  root: Hex;
  layers: Hex[][];
  index: Map<number, number>;
}

/** Leaves are ordered by tokenId. An odd node is promoted unchanged to the next layer. */
export function buildTree(leaves: LeafData[]): MerkleTree {
  const sorted = [...leaves].sort((x, y) => x.tokenId - y.tokenId);
  const index = new Map<number, number>();
  sorted.forEach((l, i) => index.set(l.tokenId, i));
  let layer = sorted.map(leafHash);
  const layers: Hex[][] = [layer];
  if (layer.length === 0) return { root: keccak256("0x"), layers, index };
  while (layer.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(i + 1 < layer.length ? hashPair(layer[i], layer[i + 1]) : layer[i]);
    }
    layers.push(next);
    layer = next;
  }
  return { root: layer[0], layers, index };
}

export function proofFor(tree: MerkleTree, tokenId: number): Hex[] | null {
  const idx = tree.index.get(tokenId);
  if (idx === undefined) return null;
  const proof: Hex[] = [];
  let i = idx;
  for (let l = 0; l < tree.layers.length - 1; l++) {
    const layer = tree.layers[l];
    const sib = i % 2 === 0 ? i + 1 : i - 1;
    if (sib < layer.length) proof.push(layer[sib]);
    i = Math.floor(i / 2);
  }
  return proof;
}

export function verifyProof(root: Hex, leaf: Hex, proof: Hex[]): boolean {
  let h = leaf;
  for (const p of proof) h = hashPair(h, p);
  return h.toLowerCase() === root.toLowerCase();
}
