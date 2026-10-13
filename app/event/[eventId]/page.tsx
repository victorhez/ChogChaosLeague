import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChogImage, EVENT_LABEL, OUTCOME_LABEL } from "@/components/bits";
import { isHistory } from "@/lib/config";
import { ReplayPanel } from "@/components/ReplayPanel";
import { ShareButtons } from "@/components/ShareButtons";
import { chogName } from "@/lib/chog";
import { loadEvent } from "@/lib/server/league";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params;
  const f = await loadEvent(eventId);
  if (!f) return { title: "Event not found" };
  const t = `${chogName(f.event.a.tokenId)} vs ${chogName(f.event.b.tokenId)} · ${EVENT_LABEL[f.event.type]}`;
  return { title: t, description: "Replay this Chog Chaos League event and verify the result yourself.", openGraph: { title: t, images: [`/api/card/${eventId}`] }, twitter: { card: "summary_large_image", images: [`/api/card/${eventId}`] } };
}

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const f = await loadEvent(eventId);
  if (!f) notFound();
  const e = f.event;
  const a = chogName(e.a.tokenId), b = chogName(e.b.tokenId);
  const winner = e.result.winner === "a" ? a : e.result.winner === "b" ? b : null;

  return (
    <div className="wrap" style={{ padding: "36px 0 72px", maxWidth: 900 }}>
      <Link href="/arena" className="muted">← Arena</Link>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, margin: "22px 0 8px", flexWrap: "wrap" }}>
        <Link href={`/chog/${e.a.tokenId}`} style={{ textAlign: "center" }}><ChogImage id={e.a.tokenId} size={140} alt={a} /><div className="mono" style={{ fontSize: ".8rem" }}>token #{e.a.tokenId} · {e.a.stance}{e.a.nudged ? " · nudged" : ""}</div></Link>
        <h1 style={{ fontSize: "3rem", color: "var(--orange)" }}>VS</h1>
        <Link href={`/chog/${e.b.tokenId}`} style={{ textAlign: "center" }}><ChogImage id={e.b.tokenId} size={140} alt={b} /><div className="mono" style={{ fontSize: ".8rem" }}>token #{e.b.tokenId} · {e.b.stance}{e.b.nudged ? " · nudged" : ""}</div></Link>
      </div>
      <h2 style={{ textAlign: "center", fontSize: "clamp(1.5rem,4vw,2.4rem)" }}>{a} vs {b}</h2>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "14px 0 26px", flexWrap: "wrap" }}>
        <span className="pill">{EVENT_LABEL[e.type]}</span>
        <span className={`pill ${e.result.highlight ? "pill-orange" : ""}`}>{OUTCOME_LABEL[e.result.outcome]}</span>
        <span className="pill">Round {e.roundId}</span>
        {isHistory(e.roundId) && <span className="pill pill-muted" title="Computed from a past Monad block. No owner nudged this round.">Replayed history</span>}
      </div>
      <ReplayPanel
        data={{
          eventId: e.eventId, type: e.type, seedHash: e.seed.hash, seedBlock: e.seed.block, seedSource: e.seed.source,
          a: { tokenId: e.a.tokenId, genome: e.a.genome, stance: e.a.stance },
          b: { tokenId: e.b.tokenId, genome: e.b.genome, stance: e.b.stance },
          stored: e.result,
        }}
      />
      <div className="card" style={{ marginTop: 20, display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div><h3>Share this moment</h3><p className="muted">The link opens this exact replay. The card image is rendered on the server.</p></div>
        <ShareButtons path={`/event/${e.eventId}`} text={winner ? `${winner} just won a ${EVENT_LABEL[e.type]} in the Chog Chaos League. Replay it and check the proof:` : `${a} and ${b} drew in the Chog Chaos League. Replay it:`} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/card/${e.eventId}`} alt={`Highlight card: ${a} versus ${b}`} style={{ width: "100%", borderRadius: 18, marginTop: 20, border: "1px solid var(--line)" }} loading="lazy" />
    </div>
  );
}
