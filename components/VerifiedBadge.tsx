"use client";

import { useEffect, useState } from "react";
import { leafHash, verifyProof, type LeafData } from "@/lib/merkle";
import { onchainRoot } from "@/lib/chain";
import { ANCHOR_TXS, LEDGER_ADDRESS, CHAIN } from "@/lib/config";

type S = "valid-checking" | "verified" | "pending" | "mismatch" | "invalid";

/**
 * Verifies the Merkle proof (synchronously, so server-rendered HTML already shows a real state), then compares the
 * root with ChaosLedger on Monad when the contract is configured.
 */
export function VerifiedBadge({ leaf, proof, root, complete, chainRoot }: { leaf: LeafData; proof: `0x${string}`[]; root: `0x${string}`; complete: boolean; chainRoot?: `0x${string}` | null }) {
  const valid = verifyProof(root, leafHash(leaf), proof);
  const decide = (chain: `0x${string}` | null | undefined): S | null => {
    if (chain === undefined) return null; // unknown: ask the chain from the browser
    if (!chain || /^0x0+$/.test(chain)) return "pending";
    return chain.toLowerCase() === root.toLowerCase() ? "verified" : "mismatch";
  };
  const initial = !valid ? "invalid" : !LEDGER_ADDRESS ? "pending" : decide(chainRoot) ?? "valid-checking";
  const [s, setS] = useState<S>(initial);

  useEffect(() => {
    if (!valid || !LEDGER_ADDRESS || initial !== "valid-checking") return;
    let live = true;
    onchainRoot(leaf.seasonId).then((chain) => {
      if (!live) return;
      if (!chain || /^0x0+$/.test(chain)) setS("pending");
      else setS(chain.toLowerCase() === root.toLowerCase() ? "verified" : "mismatch");
    });
    return () => { live = false; };
  }, [valid, leaf.seasonId, root, initial]);

  if (s === "verified") return <a className="pill pill-mint" href={ANCHOR_TXS[leaf.seasonId] ? `${CHAIN.explorer}/tx/${ANCHOR_TXS[leaf.seasonId]}` : `${CHAIN.explorer}/address/${LEDGER_ADDRESS}`} target="_blank" rel="noreferrer" title="Merkle proof matches the root stored in ChaosLedger on Monad. Click to open the transaction that wrote it.">✔ Verified on Monad</a>;
  if (s === "valid-checking") return <span className="pill pill-muted">Proof valid · reading chain…</span>;
  if (s === "pending") return <span className="pill pill-orange" title="The Merkle proof is valid against the computed season root. That root has not been written to ChaosLedger yet.">{complete ? "Proof valid · root not on chain yet" : "Season live · proof valid"}</span>;
  if (s === "mismatch") return <span className="pill pill-orange">Root differs from chain</span>;
  return <span className="pill pill-orange">Proof invalid</span>;
}
