"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWallet } from "@/lib/wallet";

const LINKS = [
  { href: "/arena", label: "Arena" },
  { href: "/play", label: "My Chogs" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/fairness", label: "Fairness" },
  { href: "/test-guide", label: "Test guide" },
];

export function WalletButton() {
  const w = useWallet();
  if (w.address) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={w.disconnect} title="Disconnect">
        <span className="dot" /> {w.address.slice(0, 6)}…{w.address.slice(-4)}
      </button>
    );
  }
  return (
    <button className="btn btn-purple btn-sm" onClick={w.connect} disabled={w.connecting}>
      {w.connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <img src="/chogs/7.webp" alt="" width={38} height={38} style={{ borderRadius: 10, objectFit: "cover" }} />
          <span>Chog Chaos<br />League</span>
        </Link>
        <button className="btn btn-ghost btn-sm nav-toggle" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Menu"}
        </button>
        <nav className={`nav-links ${open ? "open" : ""}`} aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
