import Link from "next/link";
import { GENES, type Genome } from "@/lib/engine/types";
import { GENE_COLOR, chogName } from "@/lib/chog";
import type { EventRecord } from "@/lib/server/league";

export function Sprite({ id, size = 64, alt = "" }: { id: number; size?: number; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="px" src={`/sprite/${id}.svg`} width={size} height={size} alt={alt} loading="lazy" decoding="async" />;
}

export function GeneBars({ genome }: { genome: Genome }) {
  return (
    <div role="list" aria-label="Genes">
      {GENES.map((g) => (
        <div className="gene" role="listitem" key={g} style={{ ["--v" as string]: genome[g], ["--c" as string]: GENE_COLOR[g] }}>
          <span>{g}</span>
          <div className="bar"><i /></div>
          <span>{genome[g]}</span>
        </div>
      ))}
    </div>
  );
}

export const EVENT_LABEL: Record<string, string> = {
  "prank-heist": "Prank Heist",
  "meme-duel": "Meme Duel",
  "meadow-race": "Meadow Race",
  "alliance-betrayal": "Alliance Betrayal",
};

export const OUTCOME_LABEL: Record<string, string> = {
  clean: "Clean win",
  "photo-finish": "Photo finish",
  upset: "Upset",
  "shared-loot": "Shared loot",
  betrayal: "Betrayal",
  "mutual-backstab": "Double backstab",
};

export function EventRow({ e, headline }: { e: EventRecord; headline?: string }) {
  const r = e.result;
  const w = r.winner === "a" ? e.a.tokenId : r.winner === "b" ? e.b.tokenId : null;
  return (
    <Link href={`/event/${e.eventId}`} className={`ev ${r.highlight ? "hot" : ""}`}>
      <div className="vs">
        <Sprite id={e.a.tokenId} size={44} />
        <em>VS</em>
        <Sprite id={e.b.tokenId} size={44} />
      </div>
      <div>
        <h4>{chogName(e.a.tokenId)} vs {chogName(e.b.tokenId)}</h4>
        <p>{headline ?? (w ? `${chogName(w)} wins · ${OUTCOME_LABEL[r.outcome]}` : OUTCOME_LABEL[r.outcome])}</p>
      </div>
      <div className="end">
        <span className={`tag ${r.highlight ? "pill pill-orange" : "muted"}`}>{EVENT_LABEL[e.type]}</span>
      </div>
    </Link>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="sectionhead">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 style={{ fontSize: "clamp(2rem,5.5vw,3.6rem)", marginTop: 8 }}>{title}</h1>
      </div>
      {children}
    </div>
  );
}
