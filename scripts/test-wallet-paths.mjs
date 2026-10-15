// End-to-end checks of the wallet paths against a running site (default: the live deployment).
//   node scripts/test-wallet-paths.mjs [siteUrl]
// Optional positive path (writes ONE real nudge for a Chog you hold, then you cannot nudge it again today):
//   HOLDER_PRIVATE_KEY=0x... node scripts/test-wallet-paths.mjs
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

const site = (process.argv[2] ?? "https://chog-chaos-league.vercel.app").replace(/\/$/, "");
const msg = (token, day, stance, issuedAt, nonce) => `Chog Chaos League nudge\nChog token: #${token}\nDay: ${day}\nStance: ${stance}\nIssued: ${new Date(issuedAt).toISOString()}\nNonce: ${nonce}`;
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`); };

const win = (await (await fetch(`${site}/api/nudge?token=1`)).json()).window;
console.log(`nudge window: day ${win.day}, open=${win.open}, from round ${win.fromRound}\n`);

async function post(acct, token, { signer = acct, stance = "bold", day = win.day, issuedAt = Date.now() - 1000, ownerAddr = acct.address } = {}) {
  const nonce = randomBytes(16).toString("hex");
  const signature = await signer.signMessage({ message: msg(token, day, stance, issuedAt, nonce) });
  const res = await fetch(`${site}/api/nudge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId: token, stance, owner: ownerAddr, day, issuedAt, nonce, signature }) });
  return { status: res.status, body: await res.json() };
}

const nonHolder = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());

// 1. Non-holder: valid signature, but the wallet does not own the Chog on Monad
let r = await post(nonHolder, 1);
check("non-holder with a valid signature is rejected (403)", r.status === 403, r.body.error);
const stored = await (await fetch(`${site}/api/nudge?token=1`)).json();
check("…and nothing was stored for that Chog", !stored.nudge || stored.nudge.owner.toLowerCase() !== nonHolder.address.toLowerCase());

// 2. Signature from a different wallet than the claimed owner
r = await post(nonHolder, 1, { signer: other });
check("signature from another wallet is rejected (401)", r.status === 401, r.body.error);

// 3. Expired signature (replay protection)
r = await post(nonHolder, 1, { issuedAt: Date.now() - 20 * 60_000 });
check("expired signature is rejected (401)", r.status === 401, r.body.error);

// 4. Stale day
r = await post(nonHolder, 1, { day: win.day - 1 });
check("wrong day is rejected (409)", r.status === 409, r.body.error);

// 5. Token outside the collection
r = await post(nonHolder, 5000);
check("token outside the collection is rejected (404)", r.status === 404, r.body.error);

// 6. A wallet with no Chog sees no Chogs to play
const owned = await (await fetch(`${site}/api/owned?address=${nonHolder.address}`)).json();
check("/api/owned returns no Chogs for a wallet without one", Array.isArray(owned.chogs) && owned.chogs.length === 0);

// 7. Sandbox is separate: public, unauthenticated, and says nothing is stored
const sb = await (await fetch(`${site}/sandbox`)).text();
check("sandbox page is public and states it awards nothing", sb.includes("no season points") && sb.includes("never stored"));
const c1 = await fetch(`${site}/api/chog/1`);
check("sandbox data comes from the read-only Chog endpoint", c1.status === 200);

// 8. Optional: the holder path
if (process.env.HOLDER_PRIVATE_KEY) {
  const holder = privateKeyToAccount(process.env.HOLDER_PRIVATE_KEY);
  const h = await (await fetch(`${site}/api/owned?address=${holder.address}`)).json();
  check("holder wallet is recognised with real Chogs", h.chogs?.length > 0, `${h.chogs?.length ?? 0} Chog(s)`);
  if (h.chogs?.length) {
    const t = h.chogs[0].tokenId;
    r = await post(holder, t, { stance: "sneaky" });
    check(`holder nudge for token #${t} is accepted (200) or already set today (409)`, r.status === 200 || (r.status === 409 && /already/.test(r.body.error)), r.body.error ?? "recorded");
  }
} else console.log("\n(skipped: set HOLDER_PRIVATE_KEY to also test the holder path)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
