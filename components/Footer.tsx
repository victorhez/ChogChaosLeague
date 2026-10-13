import Link from "next/link";
import { REPO_URL } from "@/lib/config";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap fgrid">
        <div style={{ maxWidth: 420 }}>
          <b style={{ color: "var(--cloud)", fontFamily: "var(--font-display)", textTransform: "uppercase" }}>Chog Chaos League</b>
          <p style={{ marginTop: 8 }}>A persistent pixel meadow where every Chog NFT is a creature with a verifiable career. Rules are code. Randomness is the Monad block hash. Narration is text only.</p>
          <p style={{ marginTop: 8 }}>Built for Chogathon 2026. Independent fan project, not affiliated with the Chog team. No wagering, no price promises.</p>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Link href="/arena">Arena</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/fairness">Fairness and replay</Link>
          <Link href="/status">Status</Link>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Link href="/test-guide">Testing guide</Link>
          <Link href="/sandbox">Sandbox</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://chogathon.chog.xyz/" target="_blank" rel="noreferrer">Chogathon</a>
        </div>
      </div>
    </footer>
  );
}
