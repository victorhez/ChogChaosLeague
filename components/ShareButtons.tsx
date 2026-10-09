"use client";

import { useState } from "react";

export function ShareButtons({ text, path }: { text: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => (typeof window !== "undefined" ? window.location.origin : "") + path;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button className="btn btn-primary btn-sm" onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url())}`, "_blank", "noopener")}>
        Share to X
      </button>
      <button className="btn btn-ghost btn-sm" onClick={async () => { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
        {copied ? "Copied" : "Copy replay link"}
      </button>
    </div>
  );
}
