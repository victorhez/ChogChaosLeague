"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createWalletClient, custom } from "viem";
import { monad, chogsOf, demoOwned } from "./chain";
import { CHAIN, CHOG_CONTRACT } from "./config";

interface Eth {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}
const eth = (): Eth | undefined => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eth }).ethereum : undefined);

interface WalletCtx {
  address?: `0x${string}`;
  connecting: boolean;
  hasProvider: boolean;
  /** "chain" when the Chog collection is configured, otherwise "demo" (adopted demo Chogs). */
  mode: "chain" | "demo";
  myChogs: number[];
  error?: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  sign: (message: string) => Promise<string>;
}

const Ctx = createContext<WalletCtx | null>(null);
export const useWallet = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}`>();
  const [myChogs, setMyChogs] = useState<number[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const [hasProvider, setHasProvider] = useState(false);
  const mode = CHOG_CONTRACT ? "chain" : "demo";

  const load = useCallback(async (a: `0x${string}`) => {
    setAddress(a);
    setMyChogs(CHOG_CONTRACT ? await chogsOf(a) : demoOwned(a));
  }, []);

  useEffect(() => {
    const e = eth();
    setHasProvider(Boolean(e));
    if (!e) return;
    e.request({ method: "eth_accounts" }).then((r) => {
      const a = (r as string[])[0];
      if (a && localStorage.getItem("ccl:connected") === "1") void load(a as `0x${string}`);
    }).catch(() => {});
    const onAcc = (...args: unknown[]) => {
      const a = (args[0] as string[])[0];
      if (a) void load(a as `0x${string}`); else { setAddress(undefined); setMyChogs([]); }
    };
    (e as unknown as { on?: (ev: string, f: (...a: unknown[]) => void) => void }).on?.("accountsChanged", onAcc);
  }, [load]);

  const connect = useCallback(async () => {
    const e = eth();
    setError(undefined);
    if (!e) { setError("No wallet found. Install a Monad-compatible wallet or use spectator mode."); return; }
    setConnecting(true);
    try {
      const accounts = (await e.request({ method: "eth_requestAccounts" })) as string[];
      try {
        await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + CHAIN.id.toString(16) }] });
      } catch (err) {
        if ((err as { code?: number }).code === 4902) {
          await e.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: "0x" + CHAIN.id.toString(16), chainName: "Monad", nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 }, rpcUrls: ["https://rpc.monad.xyz"], blockExplorerUrls: [CHAIN.explorer] }],
          });
        }
      }
      localStorage.setItem("ccl:connected", "1");
      await load(accounts[0] as `0x${string}`);
    } catch (err) {
      setError((err as Error).message?.slice(0, 120) || "Connection cancelled");
    } finally {
      setConnecting(false);
    }
  }, [load]);

  const disconnect = useCallback(() => {
    localStorage.removeItem("ccl:connected");
    setAddress(undefined);
    setMyChogs([]);
  }, []);

  const sign = useCallback(async (message: string) => {
    const e = eth();
    if (!e || !address) throw new Error("Connect a wallet first");
    const client = createWalletClient({ chain: monad, transport: custom(e as Parameters<typeof custom>[0]) });
    return client.signMessage({ account: address, message });
  }, [address]);

  const value = useMemo(() => ({ address, connecting, hasProvider, mode, myChogs, error, connect, disconnect, sign }) as WalletCtx, [address, connecting, hasProvider, mode, myChogs, error, connect, disconnect, sign]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
