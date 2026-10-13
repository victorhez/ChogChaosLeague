import { imagePath, inCollection } from "@/lib/server/collection";

export const maxDuration = 30;

const GATEWAYS = ["https://ipfs.filebase.io/ipfs/", "https://4everland.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"];

/** Real Chog art from IPFS, proxied and cached at the edge so pages do not hotlink public gateways. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const path = inCollection(n) ? imagePath(n) : null;
  if (!path) return new Response("not found", { status: 404 });
  for (let i = 0; i < GATEWAYS.length * 2; i++) {
    try {
      const res = await fetch(GATEWAYS[(n + i) % GATEWAYS.length] + path, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      return new Response(buf, {
        headers: { "content-type": res.headers.get("content-type") ?? "image/webp", "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" },
      });
    } catch {
      /* try the next gateway */
    }
  }
  return new Response("image temporarily unavailable", { status: 502, headers: { "cache-control": "no-store" } });
}
