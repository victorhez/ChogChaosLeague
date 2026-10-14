// Builds 128px webp thumbnails of the real Chog art into public/chogs/<tokenId>.webp (static, CDN-served).
//   node scripts/build-thumbs.mjs      (resumes; skips files that already exist)
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const col = JSON.parse(readFileSync(new URL("../data/collection.json", import.meta.url), "utf8"));
const GATEWAYS = ["https://ipfs.filebase.io/ipfs/", "https://4everland.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"];
const ids = Object.keys(col).map(Number).sort((a, b) => a - b).filter((id) => !existsSync(new URL(`../public/chogs/${id}.webp`, import.meta.url)));
console.log("to build:", ids.length);

let done = 0;
async function one(id) {
  for (let t = 0; t < 6; t++) {
    for (let k = 0; k < GATEWAYS.length; k++) {
      try {
        const res = await fetch(GATEWAYS[(id + t + k) % GATEWAYS.length] + col[id].img, { signal: AbortSignal.timeout(25000) });
        if (!res.ok) continue;
        const out = await sharp(Buffer.from(await res.arrayBuffer())).resize(128, 128, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
        writeFileSync(new URL(`../public/chogs/${id}.webp`, import.meta.url), out);
        if (++done % 100 === 0) console.log(done + "/" + ids.length);
        return;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 1000 * (t + 1)));
  }
  console.log("failed", id);
}
const queue = [...ids];
await Promise.all(Array.from({ length: 14 }, async () => { while (queue.length) await one(queue.shift()); }));
console.log("done", done);
