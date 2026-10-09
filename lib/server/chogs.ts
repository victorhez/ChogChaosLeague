import { LEAGUE_SIZE } from "../config";
import { demoChog, type Chog } from "../chog";
import { fetchChog } from "../chain";
import { getRoster } from "./league";

const extra = new Map<number, Chog>();

export const validTokenId = (n: number) => Number.isInteger(n) && n >= 1 && n <= 10000;

/** Any token id 1..10000 can be looked up in spectator mode. Ids inside the league roster use the roster data. */
export async function getChog(tokenId: number): Promise<Chog> {
  if (tokenId <= LEAGUE_SIZE) {
    const roster = await getRoster();
    return roster.find((c) => c.tokenId === tokenId) ?? demoChog(tokenId);
  }
  const hit = extra.get(tokenId);
  if (hit) return hit;
  const c = await fetchChog(tokenId);
  extra.set(tokenId, c);
  return c;
}
