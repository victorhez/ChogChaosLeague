// Writes one completed season's Merkle root to ChaosLedger.
//   PRIVATE_KEY=0x... LEDGER=0x... node scripts/anchor-season.mjs <seasonId> [siteUrl]
// The root comes from the public /api/season/<id> endpoint; anyone can recompute it from public data and compare.
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const [seasonArg, siteArg] = process.argv.slice(2);
const site = (siteArg ?? "https://chog-chaos-league.vercel.app").replace(/\/$/, "");
const key = process.env.PRIVATE_KEY, ledger = process.env.LEDGER;
if (!seasonArg || !/^0x[0-9a-fA-F]{64}$/.test(key ?? "") || !/^0x[0-9a-fA-F]{40}$/.test(ledger ?? "")) {
  console.error("usage: PRIVATE_KEY=0x... LEDGER=0x... node scripts/anchor-season.mjs <seasonId> [siteUrl]"); process.exit(2);
}
const season = await (await fetch(`${site}/api/season/${seasonArg}`)).json();
if (!season.root) { console.error("Season not found:", season); process.exit(1); }
if (!season.complete) { console.error(`Season ${seasonArg} is not complete yet (${season.rounds} rounds). Anchor it after its last round closes.`); process.exit(1); }
console.log(`season ${season.seasonId}: root ${season.root}, ${season.rounds} rounds${season.history ? " (replayed history)" : ""}`);

const monad = defineChain({ id: 143, name: "Monad", nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } } });
const abi = parseAbi(["function anchorSeason(uint256,bytes32,uint256)", "function roots(uint256) view returns (bytes32)"]);
const account = privateKeyToAccount(key);
const pub = createPublicClient({ chain: monad, transport: http() });
const wallet = createWalletClient({ account, chain: monad, transport: http() });
const hash = await wallet.writeContract({ address: ledger, abi, functionName: "anchorSeason", args: [BigInt(season.seasonId), season.root, BigInt(season.rounds)] });
console.log("tx", hash);
await pub.waitForTransactionReceipt({ hash });
console.log("on-chain root:", await pub.readContract({ address: ledger, abi, functionName: "roots", args: [BigInt(season.seasonId)] }));
