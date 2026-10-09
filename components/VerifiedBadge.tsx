"use client";

import { useEffect, useState } from "react";
import { leafHash, verifyProof, type LeafData } from "@/lib/merkle";
import { onchainRoot } from "@/lib/chain";
import { LEDGER_ADDRESS, CHAIN } from "@/lib/config";

type S = "checking" | "verified" | "pending" | "mismatch" | "invalid";

/** Verifies the Merkle proof in the browser, then compares the root with ChaosLedger on Monad when it is deployed. */
export function VerifiedBadge({ leaf, proof, root, complete }: { leaf: LeafData; proof: `0x${string}`[]; root: `0x${string}`; complete: boolean }) {
  const [s, setS] = useState<S>("checking");
  useEffect(() => {
    let live = true;
    (async () => {
      if (!verifyProof(root, leafHash(leaf), proof)) return live && setS("invalid");
      if (!LEDGER_ADDRESS) return live && setS("pending");
      const chain = await onchainRoot(leaf.seasonId);
      if (!live) return;
      if (!chain || /^0x0+$/.test(chain)) setS("pending");
      else setS(chain.toLowerCase() === root.toLowerCase() ? "verified" : "mismatch");
    })();
    return () => { live = false; };
  }, [leaf, proof, root]);

  if (s === "checking") return <span className="pill pill-muted">Checking proof…</span>;
  if (s === "verified") return <a className="pill pill-mint" href={`${CHAIN.explorer}/address/${LEDGER_ADDRESS}`} target="_blank" rel="noreferrer" title="Merkle proof matches the root stored in ChaosLedger on Monad">✔ Verified on Monad</a>;
  if (s === "pending") return <span className="pill pill-orange" title="The Merkle proof is valid against the computed season root. The root has not been written to ChaosLedger yet.">{complete ? "Proof valid · anchor pending" : "Season live · proof valid"}</span>;
  if (s === "mismatch") return <span className="pill pill-orange">Root differs from chain</span>;
  return <span className="pill pill-orange">Proof invalid</span>;
}
