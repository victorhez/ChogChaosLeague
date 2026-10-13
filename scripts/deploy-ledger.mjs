// Deploys ChaosLedger to Monad without Foundry. Compiles the Solidity source with solc-js, then sends one transaction.
//   PRIVATE_KEY=0x... node scripts/deploy-ledger.mjs
// Use a fresh wallet funded with a little MON (never a wallet that holds real funds). The key stays on your machine.
import solc from "solc";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const key = process.env.PRIVATE_KEY;
if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? "")) { console.error("Set PRIVATE_KEY=0x... (64 hex chars) for a funded deployer wallet."); process.exit(2); }

const src = readFileSync(new URL("../contracts/src/ChaosLedger.sol", import.meta.url), "utf8");
const out = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources: { "ChaosLedger.sol": { content: src } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
})));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
if (errors.length) { console.error(errors.map((e) => e.formattedMessage).join("\n")); process.exit(1); }
const c = out.contracts["ChaosLedger.sol"].ChaosLedger;

const monad = defineChain({ id: 143, name: "Monad", nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } } });
const account = privateKeyToAccount(key);
const pub = createPublicClient({ chain: monad, transport: http() });
const wallet = createWalletClient({ account, chain: monad, transport: http() });
console.log("deployer", account.address);
const hash = await wallet.deployContract({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object, args: [account.address] });
console.log("tx", hash);
const rcpt = await pub.waitForTransactionReceipt({ hash });
console.log("ChaosLedger deployed at", rcpt.contractAddress);
console.log("\nNext: set NEXT_PUBLIC_LEDGER_ADDRESS=" + rcpt.contractAddress + " in Vercel, redeploy, then run scripts/anchor-season.mjs");
