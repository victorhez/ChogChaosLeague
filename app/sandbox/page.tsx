import type { Metadata } from "next";
import { PageHead } from "@/components/bits";
import { SandboxPanel } from "@/components/SandboxPanel";

export const metadata: Metadata = { title: "Sandbox" };

export default function Sandbox() {
  return (
    <div className="wrap" style={{ padding: "36px 0 72px", maxWidth: 900 }}>
      <PageHead eyebrow="Practice mode · no wallet needed" title="Sandbox" />
      <SandboxPanel />
    </div>
  );
}
