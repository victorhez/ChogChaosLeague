import { createPublicClient, defineChain, fallback, http, parseAbi } from "viem";
import { CHAIN, CHOG_CONTRACT, LEDGER_ADDRESS, RPC_URLS } from "./config";
import { chogFromTraits, demoChog, type Chog } from "./chog";
import type { Traits } from "./genome/genome";

export const monad = defineChain({
  id: CHAIN.id,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  blockExplorers: { default: { name: "Monadscan", url: CHAIN.explorer } },
});

export const publicClient = createPublicClient({
  chain: monad,
  transport: fallback(RPC_URLS.map((u) => http(u, { timeout: 6000, retryCount: 1 }))),
});

const erc721 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
]);

export const ledgerAbi = parseAbi([
  "function roots(uint256 seasonId) view returns (bytes32)",
  "function verify(uint256 seasonId, uint256 tokenId, uint256 points, uint256 wins, uint256 losses, uint256 bestStreak, bytes32[] proof) view returns (bool)",
]);

const toHttp = (u: string) => (u.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${u.slice(7)}` : u);

/** Read a Chog's traits from the collection. Falls back to labelled demo traits if anything fails. */
export async function fetchChog(tokenId: number): Promise<Chog> {
  if (!CHOG_CONTRACT) return demoChog(tokenId);
  try {
    const uri = await publicClient.readContract({ address: CHOG_CONTRACT, abi: erc721, functionName: "tokenURI", args: [BigInt(tokenId)] });
    const res = await fetch(toHttp(uri), { signal: AbortSignal.timeout(6000) });
    const meta = (await res.json()) as { attributes?: { trait_type: string; value: string | number }[] };
    const traits: Traits = {};
    for (const a of meta.attributes ?? []) traits[String(a.trait_type)] = String(a.value);
    if (!Object.keys(traits).length) return demoChog(tokenId);
    return chogFromTraits(tokenId, traits, "chain");
  } catch {
    return demoChog(tokenId);
  }
}

/** Token ids held by a wallet (ERC-721 Enumerable). Empty when the collection is not configured. */
export async function chogsOf(owner: `0x${string}`): Promise<number[]> {
  if (!CHOG_CONTRACT) return [];
  try {
    const n = Number(await publicClient.readContract({ address: CHOG_CONTRACT, abi: erc721, functionName: "balanceOf", args: [owner] }));
    const ids = await Promise.all(
      Array.from({ length: Math.min(n, 12) }, (_, i) =>
        publicClient.readContract({ address: CHOG_CONTRACT as `0x${string}`, abi: erc721, functionName: "tokenOfOwnerByIndex", args: [owner, BigInt(i)] }),
      ),
    );
    return ids.map(Number);
  } catch {
    return [];
  }
}

export async function ownerOf(tokenId: number): Promise<`0x${string}` | null> {
  if (!CHOG_CONTRACT) return null;
  try {
    return await publicClient.readContract({ address: CHOG_CONTRACT, abi: erc721, functionName: "ownerOf", args: [BigInt(tokenId)] });
  } catch {
    return null;
  }
}

export const ledgerConfigured = () => Boolean(LEDGER_ADDRESS);

export async function onchainRoot(seasonId: number): Promise<`0x${string}` | null> {
  if (!LEDGER_ADDRESS) return null;
  try {
    return await publicClient.readContract({ address: LEDGER_ADDRESS, abi: ledgerAbi, functionName: "roots", args: [BigInt(seasonId)] });
  } catch {
    return null;
  }
}

/** Demo ownership: when no collection is configured, a wallet "adopts" three deterministic demo Chogs. */
export function demoOwned(address: string, size = 48): number[] {
  const n = BigInt(address.toLowerCase());
  return [Number(n % BigInt(size)) + 1, Number((n / 97n) % BigInt(size)) + 1, Number((n / 9973n) % BigInt(size)) + 1]
    .filter((v, i, a) => a.indexOf(v) === i);
}
