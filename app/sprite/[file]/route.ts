import { spriteSvg } from "@/lib/sprite";
import { getChog, validTokenId } from "@/lib/server/chogs";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = Number(file.replace(/\.svg$/, ""));
  if (!validTokenId(id)) return new Response("not found", { status: 404 });
  const chog = await getChog(id);
  return new Response(spriteSvg(chog, 160), {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
