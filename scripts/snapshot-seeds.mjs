// Caches the seed block hash of every closed round in lib/seeds.json. Past blocks never change,
// so this only saves RPC round trips. Anyone can regenerate it and diff: node scripts/snapshot-seeds.mjs
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const ANCHOR = 109_500_000, BPR = 9_000, FINALITY = 200;
const RPC = process.env.NEXT_PUBLIC_MONAD_RPC || "https://rpc.monad.xyz";
const call = async (body) => (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

const head = parseInt((await call({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })).result, 16);
const lastClosed = Math.floor((head - FINALITY - ANCHOR) / BPR) - 2; // leave the newest rounds to the live path
const file = new URL("../lib/seeds.json", import.meta.url);
const seeds = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const need = [];
for (let r = 0; r <= lastClosed; r++) if (!seeds[r]) need.push(r);
for (let i = 0; i < need.length; i += 25) {
  const slice = need.slice(i, i + 25);
  let res = await call(slice.map((r, k) => ({ jsonrpc: "2.0", id: k, method: "eth_getBlockByNumber", params: ["0x" + (ANCHOR + r * BPR).toString(16), false] })));
  for (let t = 0; !Array.isArray(res) && t < 8; t++) { await new Promise((r) => setTimeout(r, 1500)); res = await call(slice.map((r, k) => ({ jsonrpc: "2.0", id: k, method: "eth_getBlockByNumber", params: ["0x" + (ANCHOR + r * BPR).toString(16), false] }))); }
  for (const item of res) if (item.result) seeds[slice[item.id]] = item.result.hash;
  console.log(`fetched ${Math.min(i + 25, need.length)}/${need.length}`);
}
writeFileSync(file, JSON.stringify(seeds));
console.log(`seeds.json: ${Object.keys(seeds).length} rounds (0..${lastClosed})`);
