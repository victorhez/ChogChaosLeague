import { NextResponse } from "next/server";
import { chogsOf } from "@/lib/chain";
import { collectionChog } from "@/lib/server/collection";
import { limited } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Chogs held by a wallet, read live from the Chog Genesis contract on Monad. */
export async function GET(req: Request) {
  if (limited(req, "owned", 20)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: "Bad address" }, { status: 400 });
  const ids = await chogsOf(address as `0x${string}`);
  if (ids === null) return NextResponse.json({ error: "Could not read Monad right now" }, { status: 503 });
  const chogs = ids.map((id) => collectionChog(id)).filter(Boolean).map((c) => ({ tokenId: c!.tokenId, name: c!.name, traits: c!.traits, genome: c!.genome }));
  return NextResponse.json({ address, chogs });
}
