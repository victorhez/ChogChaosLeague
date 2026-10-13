// Downloads the real Chog Genesis metadata (1,969 tokens) into data/collection.json.
//   node scripts/fetch-collection.mjs
// Token ids come from the contract; the number inside a token's name does not equal its id.
import { createPublicClient, defineChain, http, parseAbi } from "viem";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const CONTRACT = "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763";
const GATEWAYS = ["https://ipfs.filebase.io/ipfs/", "https://4everland.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"];
const monad = defineChain({ id: 143, name: "Monad", nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } } });
const client = createPublicClient({ chain: monad, transport: http("https://rpc.monad.xyz") });
const abi = parseAbi(["function totalSupply() view returns (uint256)", "function tokenURI(uint256) view returns (string)"]);

const total = Number(await client.readContract({ address: CONTRACT, abi, functionName: "totalSupply" }));
console.log("totalSupply", total);
const out = new URL(process.env.OUT ?? "../data/collection.json", import.meta.url);
const have = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
const ids = Array.from({ length: total }, (_, i) => i + 1).filter((i) => !have[i]);
if (process.env.REVERSE) ids.splice(0, ids.length - 1000);

async function getJson(path, id) {
  for (let t = 0; t < 6; t++) {
    for (let k = 0; k < GATEWAYS.length; k++) { const g = GATEWAYS[(id + t + k) % GATEWAYS.length];
      try {
        const res = await fetch(g + path, { signal: AbortSignal.timeout(20000) });
        if (res.ok) return await res.json();
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 1000 * (t + 1)));
  }
  throw new Error("failed " + path);
}

let done = 0;
async function one(id) {
  const uri = await client.readContract({ address: CONTRACT, abi, functionName: "tokenURI", args: [BigInt(id)] });
  const meta = await getJson(uri.replace("ipfs://", ""), id);
  const attrs = {};
  for (const a of meta.attributes ?? []) attrs[a.trait_type] = String(a.value);
  have[id] = { n: meta.name, img: String(meta.image).replace("ipfs://", ""), a: attrs };
  if (++done % 100 === 0) { console.log(done + "/" + ids.length); writeFileSync(out, JSON.stringify(have)); }
}
const queue = process.env.REVERSE ? [...ids].reverse() : [...ids];
await Promise.all(Array.from({ length: 18 }, async () => { while (queue.length) { const id = queue.shift(); try { await one(id); } catch (e) { console.log("retry later", id); } } }));
writeFileSync(out, JSON.stringify(have));
console.log("saved", Object.keys(have).length);
