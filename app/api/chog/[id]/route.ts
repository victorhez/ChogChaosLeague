import { NextResponse } from "next/server";
import { collectionChog } from "@/lib/server/collection";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = collectionChog(Number(id));
  if (!c) return NextResponse.json({ error: "Not a Chog token id" }, { status: 404 });
  return NextResponse.json(
    { tokenId: c.tokenId, name: c.name, traits: c.traits, genome: c.genome, image: `/api/img/${c.tokenId}` },
    { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
