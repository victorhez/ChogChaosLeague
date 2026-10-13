import raw from "../../data/collection.json";
import { chogFrom, type Chog } from "../chog";
import { COLLECTION_SIZE } from "../config";

interface Entry { n: string; img: string; a: Record<string, string> }
const DATA = raw as unknown as Record<string, Entry>;

export const TOKEN_IDS: number[] = Object.keys(DATA).map(Number).sort((a, b) => a - b);

export const inCollection = (id: number) => Number.isInteger(id) && id >= 1 && id <= COLLECTION_SIZE && Boolean(DATA[id]);

const memo = new Map<number, Chog>();

/** Chog data from the cached Chog Genesis metadata (ids and traits as read from the contract's token URIs). */
export function collectionChog(id: number): Chog | null {
  if (!inCollection(id)) return null;
  let c = memo.get(id);
  if (!c) {
    c = chogFrom(id, DATA[id].a);
    memo.set(id, c);
  }
  return c;
}

/** IPFS path of the real Chog image (without the ipfs:// prefix). */
export const imagePath = (id: number): string | null => DATA[id]?.img ?? null;

let all: Chog[] | null = null;
export function allChogs(): Chog[] {
  return (all ??= TOKEN_IDS.map((id) => collectionChog(id)!));
}
