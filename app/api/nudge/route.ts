import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { ownerOf } from "@/lib/chain";
import { getHead, leagueState, nudgeWindow } from "@/lib/server/league";
import { checkNudge, type NudgeRequest } from "@/lib/server/nudge-check";
import { loadNudges, nudgeKey, saveNudge } from "@/lib/server/nudges";
import { limited } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = Number(new URL(req.url).searchParams.get("token"));
  const win = nudgeWindow(leagueState(await getHead()));
  const book = await loadNudges();
  return NextResponse.json({ window: win, nudge: book[nudgeKey(token, win.day)] ?? null });
}

export async function POST(req: Request) {
  if (limited(req, "nudge", 12)) return NextResponse.json({ error: "Too many requests. Slow down a little." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as NudgeRequest | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const win = nudgeWindow(leagueState(await getHead()));
  const res = await checkNudge(body, { ownerOf, verify: (a) => verifyMessage(a), now: Date.now(), window: win });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const saved = await saveNudge({ tokenId: res.tokenId, day: win.day, stance: res.stance, fromRound: win.fromRound, owner: res.owner, signature: res.signature });
  if (!saved) return NextResponse.json({ error: "This Chog already has a nudge for today. One per day." }, { status: 409 });
  return NextResponse.json({ ok: true, window: win });
}
