// Saves the 128px thumbnails the live site already serves into public/chogs/<tokenId>.webp (static, CDN-served).
// The site's server reaches IPFS far more reliably than a laptop does.
//   node scripts/fetch-thumbs-from-site.mjs [siteUrl]
import { existsSync, writeFileSync } from "node:fs";

const site = (process.argv[2] ?? "https://chog-chaos-league.vercel.app").replace(/\/$/, "");
const ids = Array.from({ length: 1969 }, (_, i) => i + 1).filter((id) => !existsSync(new URL(`../public/chogs/${id}.webp`, import.meta.url)));
console.log("to fetch:", ids.length);
let done = 0, failed = 0;
async function one(id) {
  for (let t = 0; t < 5; t++) {
    try {
      const res = await fetch(`${site}/api/img/${id}?w=128`, { signal: AbortSignal.timeout(30000) });
      if (res.ok && (res.headers.get("content-type") ?? "").includes("image")) {
        writeFileSync(new URL(`../public/chogs/${id}.webp`, import.meta.url), Buffer.from(await res.arrayBuffer()));
        if (++done % 100 === 0) console.log(done + "/" + ids.length);
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1500 * (t + 1)));
  }
  failed++; console.log("failed", id);
}
const queue = [...ids];
await Promise.all(Array.from({ length: 40 }, async () => { while (queue.length) await one(queue.shift()); }));
console.log("done", done, "failed", failed);
