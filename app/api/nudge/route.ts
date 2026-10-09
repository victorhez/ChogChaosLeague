import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { STANCES, type Stance } from "@/lib/engine/types";
import { nudgeMessage } from "@/lib/nudge-shared";
import { demoOwned, ownerOf } from "@/lib/chain";
import { CHOG_CONTRACT, LEAGUE_SIZE } from "@/lib/config";
import { getHead, leagueState, nudgeWindow } from "@/lib/server/league";
import { loadNudges, nudgeKey, saveNudge } from "@/lib/server/nudges";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = Number(new URL(req.url).searchParams.get("token"));
  const st = leagueState(await getHead());
  const win = nudgeWindow(st);
  const book = await loadNudges();
  return NextResponse.json({ window: win, nudge: book[nudgeKey(token, win.day)] ?? null });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { tokenId?: number; stance?: string; owner?: string; day?: number; signature?: `0x${string}` } | null;
  if (!body || !body.tokenId || !body.owner || !body.signature || !STANCES.includes(body.stance as Stance)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const stance = body.stance as Stance;
  const owner = body.owner as `0x${string}`;
  const win = nudgeWindow(leagueState(await getHead()));
  if (!win.open) return NextResponse.json({ error: "Round is locked. Your nudge counts from the next round; try again in a moment." }, { status: 409 });
  if (body.day !== win.day) return NextResponse.json({ error: "The day rolled over while you were signing. Please sign again." }, { status: 409 });

  const valid = await verifyMessage({ address: owner, message: nudgeMessage(body.tokenId, win.day, stance), signature: body.signature }).catch(() => false);
  if (!valid) return NextResponse.json({ error: "Signature does not match the wallet." }, { status: 401 });

  // Ownership is checked at lock time, so a sold Chog is controlled by its new owner.
  if (CHOG_CONTRACT) {
    const actual = await ownerOf(body.tokenId);
    if (!actual || actual.toLowerCase() !== owner.toLowerCase()) return NextResponse.json({ error: "This wallet does not own that Chog." }, { status: 403 });
  } else if (body.tokenId > LEAGUE_SIZE || !demoOwned(owner).includes(body.tokenId)) {
    return NextResponse.json({ error: "That demo Chog is not adopted by this wallet." }, { status: 403 });
  }

  const ok = await saveNudge({ tokenId: body.tokenId, day: win.day, stance, fromRound: win.fromRound, owner, signature: body.signature });
  if (!ok) return NextResponse.json({ error: "This Chog already has a nudge for today. One per day." }, { status: 409 });
  return NextResponse.json({ ok: true, window: win });
}
