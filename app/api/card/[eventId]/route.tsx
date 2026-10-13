import { ImageResponse } from "next/og";
import sharp from "sharp";
import { imagePath } from "@/lib/server/collection";
import { limited } from "@/lib/server/ratelimit";
import { loadEvent } from "@/lib/server/league";
import { getChog } from "@/lib/server/chogs";
import { narrate } from "@/lib/narration";
import { spriteDataUri } from "@/lib/sprite";
import { auraColor } from "@/lib/chog";
import { EVENT_LABEL, OUTCOME_LABEL } from "@/components/bits";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GATEWAYS = ["https://ipfs.filebase.io/ipfs/", "https://4everland.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"];

/** Real Chog art as a PNG data URI (the card renderer cannot read webp). Null if no gateway answers in time. */
async function realArt(id: number, px: number): Promise<string | null> {
  const path = imagePath(id);
  if (!path) return null;
  for (let i = 0; i < GATEWAYS.length; i++) {
    try {
      const res = await fetch(GATEWAYS[(id + i) % GATEWAYS.length] + path, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(px, px, { fit: "cover" }).png().toBuffer();
      return "data:image/png;base64," + png.toString("base64");
    } catch {
      /* next gateway */
    }
  }
  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (limited(req, "card", 30)) return new Response("slow down", { status: 429 });
  const { eventId } = await params;
  const found = await loadEvent(eventId);
  if (!found) return new Response("not found", { status: 404 });
  const { event: e } = found;
  const [A, B] = await Promise.all([getChog(e.a.tokenId), getChog(e.b.tokenId)]);
  const input = { type: e.type, seedHash: e.seed.hash, eventId: e.eventId, a: e.a, b: e.b };
  const nar = narrate(input, e.result, { a: A.name, b: B.name });
  const [artA, artB] = await Promise.all([realArt(e.a.tokenId, 240), realArt(e.b.tokenId, 240)]);
  const winner = e.result.winner === "a" ? A : e.result.winner === "b" ? B : null;

  const Side = ({ c, won, art }: { c: typeof A; won: boolean; art: string | null }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330 }}>
      <div style={{ display: "flex", padding: 14, borderRadius: 28, background: auraColor(c.genome) + "22", border: won ? `4px solid ${auraColor(c.genome)}` : "4px solid #2c2150" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art ?? spriteDataUri(c, 240)} width={240} height={240} alt="" style={{ borderRadius: 18 }} />
      </div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 30, fontWeight: 800, color: "#F5F3FF" }}>{c.name}</div>
      <div style={{ display: "flex", fontSize: 20, color: won ? "#FF8A3D" : "#b3a9d9" }}>{won ? "WINNER" : `token #${c.tokenId}`}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: "#0E091C", padding: 48, fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 900, color: "#F5F3FF", letterSpacing: 1 }}>CHOG CHAOS LEAGUE</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", padding: "8px 18px", borderRadius: 99, background: "#836EF9", color: "#0E091C", fontSize: 22, fontWeight: 800 }}>{EVENT_LABEL[e.type]}</div>
            <div style={{ display: "flex", padding: "8px 18px", borderRadius: 99, background: "#FF8A3D", color: "#0E091C", fontSize: 22, fontWeight: 800 }}>{OUTCOME_LABEL[e.result.outcome]}</div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <Side c={A} won={e.result.winner === "a"} art={artA} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 420 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 900, color: "#FF8A3D" }}>VS</div>
            <div style={{ display: "flex", textAlign: "center", fontSize: 25, color: "#F5F3FF", marginTop: 8, lineHeight: 1.3 }}>{nar.headline}</div>
          </div>
          <Side c={B} won={e.result.winner === "b"} art={artB} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #2c2150", paddingTop: 16 }}>
          <div style={{ display: "flex", fontSize: 22, color: "#b3a9d9" }}>
            {winner ? `${winner.name} +${e.result.winner === "a" ? e.result.points.a : e.result.points.b} pts` : "Draw"} · seed block #{e.seed.block.toLocaleString("en-US")}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#3DDC97", fontWeight: 700 }}>Replay it. Verify it. {e.eventId}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=600, s-maxage=3600" } },
  );
}
