import sharp from "sharp";
import { imagePath, inCollection } from "@/lib/server/collection";

export const maxDuration = 30;

const GATEWAYS = ["https://ipfs.filebase.io/ipfs/", "https://4everland.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"];
const SIZES = [64, 128, 256, 512];

/**
 * Real Chog art from IPFS, proxied and cached at the edge so pages do not hotlink public gateways.
 * ?w=64|128|256|512 returns a small webp thumbnail (the originals are 1000px, about 280KB each).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const path = inCollection(n) ? imagePath(n) : null;
  if (!path) return new Response("not found", { status: 404 });
  const wParam = Number(new URL(req.url).searchParams.get("w"));
  const w = SIZES.find((s) => s >= wParam) ?? null;

  for (let i = 0; i < GATEWAYS.length * 2; i++) {
    try {
      const res = await fetch(GATEWAYS[(n + i) % GATEWAYS.length] + path, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const headers = { "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" };
      if (w && wParam) {
        const out = await sharp(buf).resize(w, w, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
        return new Response(new Uint8Array(out), { headers: { ...headers, "content-type": "image/webp" } });
      }
      return new Response(new Uint8Array(buf), { headers: { ...headers, "content-type": res.headers.get("content-type") ?? "image/webp" } });
    } catch {
      /* try the next gateway */
    }
  }
  return new Response("image temporarily unavailable", { status: 502, headers: { "cache-control": "no-store" } });
}
