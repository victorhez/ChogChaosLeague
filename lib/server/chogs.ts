import type { Chog } from "../chog";
import { collectionChog, inCollection } from "./collection";

/** Only ids that exist in Chog Genesis (1..1969) are valid. */
export const validTokenId = (n: number) => inCollection(n);

export async function getChog(tokenId: number): Promise<Chog> {
  const c = collectionChog(tokenId);
  if (!c) throw new Error(`Chog ${tokenId} not found`);
  return c;
}
