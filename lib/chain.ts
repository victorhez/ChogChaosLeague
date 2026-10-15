import { createPublicClient, defineChain, fallback, http, parseAbi } from "viem";
import { CHAIN, CHOG_CONTRACT, COLLECTION_SIZE, LEDGER_ADDRESS, RPC_URLS } from "./config";

export const monad = defineChain({
  id: CHAIN.id,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  blockExplorers: { default: { name: "Monadscan", url: CHAIN.explorer } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const publicClient = createPublicClient({
  chain: monad,
  transport: fallback(RPC_URLS.map((u) => http(u, { timeout: 8000, retryCount: 1 }))),
});

const erc721 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
]);

export const ledgerAbi = parseAbi([
  "function roots(uint256 seasonId) view returns (bytes32)",
  "function verify(uint256 seasonId, uint256 tokenId, uint256 points, uint256 wins, uint256 losses, uint256 bestStreak, bytes32[] proof) view returns (bool)",
]);

/** Live owner of a Chog token, read from the contract. Null if the call fails. */
export async function ownerOf(tokenId: number): Promise<`0x${string}` | null> {
  try {
    return await publicClient.readContract({ address: CHOG_CONTRACT, abi: erc721, functionName: "ownerOf", args: [BigInt(tokenId)] });
  } catch {
    return null;
  }
}

/**
 * Token ids held by a wallet. The collection is plain ERC-721 (no enumeration), so this reads balanceOf first and,
 * only if the wallet holds any, scans ownerOf for every token id through Multicall3.
 */
export async function chogsOf(owner: `0x${string}`): Promise<number[] | null> {
  try {
    const bal = await publicClient.readContract({ address: CHOG_CONTRACT, abi: erc721, functionName: "balanceOf", args: [owner] });
    if (bal === 0n) return [];
    const ids = Array.from({ length: COLLECTION_SIZE }, (_, i) => i + 1);
    const res = await publicClient.multicall({
      allowFailure: true,
      batchSize: 1 << 20,
      contracts: ids.map((id) => ({ address: CHOG_CONTRACT, abi: erc721, functionName: "ownerOf", args: [BigInt(id)] }) as const),
    });
    const mine: number[] = [];
    res.forEach((r, i) => {
      if (r.status === "success" && (r.result as string).toLowerCase() === owner.toLowerCase()) mine.push(ids[i]);
    });
    return mine;
  } catch {
    return null;
  }
}

export async function onchainRoot(seasonId: number): Promise<`0x${string}` | null> {
  if (!LEDGER_ADDRESS) return null;
  try {
    return await publicClient.readContract({ address: LEDGER_ADDRESS, abi: ledgerAbi, functionName: "roots", args: [BigInt(seasonId)] });
  } catch {
    return null;
  }
}

const rootMemo = new Map<number, `0x${string}`>();

/** Server-side root lookup: anchored roots never change, so they are cached; a slow RPC never blocks the page for long. */
export async function onchainRootForRender(seasonId: number): Promise<`0x${string}` | null | undefined> {
  if (!LEDGER_ADDRESS) return null;
  const hit = rootMemo.get(seasonId);
  if (hit) return hit;
  const r = await Promise.race([onchainRoot(seasonId), new Promise<undefined>((res) => setTimeout(() => res(undefined), 2500))]);
  if (r && !/^0x0+$/.test(r)) rootMemo.set(seasonId, r);
  return r === null ? undefined : r; // undefined = could not tell (timeout or RPC error); the browser will check
}
