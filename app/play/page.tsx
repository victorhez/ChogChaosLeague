import type { Metadata } from "next";
import { PageHead } from "@/components/bits";
import { PlayPanel } from "@/components/PlayPanel";

export const metadata: Metadata = { title: "My Chogs" };

export default function Play() {
  return (
    <div className="wrap" style={{ padding: "36px 0 72px" }}>
      <PageHead eyebrow="Connect · Wake · Nudge" title="Wake your Chog" />
      <PlayPanel />
    </div>
  );
}
