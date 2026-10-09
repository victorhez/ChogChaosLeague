<p align="center">
  <img src="public/wordmark.png" alt="Chog Chaos League" width="520" />
</p>

<p align="center">
  <b>Your Chog is not a picture. It is a creature with a career.</b><br/>
  A persistent pixel meadow where every Chog NFT causes provably fair chaos on Monad, and the record follows the token.
</p>

<p align="center">
  <a href="https://chog-chaos-league.vercel.app">Live demo</a> ·
  <a href="https://chog-chaos-league.vercel.app/fairness">Fairness</a> ·
  <a href="https://chog-chaos-league.vercel.app/test-guide">Testing guide</a> ·
  <a href="contracts/src/ChaosLedger.sol">ChaosLedger</a>
</p>

---

Built for **Chogathon 2026**.

## What it is

Chog Chaos League turns each Chog into a mischievous creature that lives in a shared pixel meadow. A Chog's traits become its genes: **Mischief, Nerve, Wit, Speed and Charm**. Every hour a round runs, and the engine pairs Chogs for a Prank Heist, Meme Duel, Meadow Race or Alliance Betrayal. Chogs play on their own, so the meadow is fun to watch even if you never touch it. Owners steer with one signed nudge a day: **Bold**, **Sneaky** or **Friendly**.

Every result is replayable. Press **Replay** on any event and your browser re-runs the engine from the stored inputs and the Monad block hash that seeded the round. Same inputs, same result, or the page says so.

## Why the NFT is essential

The organizers' test is: *if you removed the NFT, would the experience still work the same way?* Here it would not.

| The Chog is… | What it does | Without it |
| --- | --- | --- |
| **Character** | Traits are decoded into genes through a public, deterministic table. | No creature, no genome. |
| **Key** | Owning the token ID is what authorizes the daily nudge. Ownership is checked at lock time, so a sold Chog is steered by its new owner. | No control, no prize eligibility. |
| **Memory** | Season results are rolled into a Merkle root, anchored per token ID in a small contract. The profile checks its proof and shows a Verified badge. | Nowhere for a career to live. |

Spectator mode needs no wallet. Watching is free; playing needs a Chog.

## How fairness works

1. **The chain is the clock.** Round `r` is seeded by the hash of Monad block `109,500,000 + r × 9,000` (roughly one hour). A round closes once that block is 200 blocks behind head.
2. **Lock before seed.** Nudges lock 450 blocks before the seed block exists, so neither side can know the other.
3. **One engine.** A pure TypeScript module with no I/O and no hidden randomness runs on the server and in your browser. No gene weight exceeds 0.38, so no single trait decides a match.
4. **Hashed logs.** Each event stores its inputs, steps and a keccak256 log hash.
5. **Narration is text only.** The Chog Chronicle reads a finished result and can never change one. It uses templates today and has a drop-in slot for a model.

Details, the event weight table and the full trait-to-gene table are on the [fairness page](https://chog-chaos-league.vercel.app/fairness). To verify an event outside the browser:

```bash
npx tsx scripts/verify.ts r250-e3
```

## Features

- **Wallet connect and Chog detection** on Monad (chain 143), with spectator lookup for any token ID
- **Genome decoder** with a published JSON mapping table (`lib/genome/mapping.json`)
- **Chaos engine** with four event types, seeded pairing and stance counters
- **Replay and seed check** in the browser, plus an RPC comparison of the seed block hash
- **Pixel arena** drawn on canvas, mobile-first, reduced-motion aware, with a profile drawer per Chog
- **Daily nudge** signed with the wallet, one per Chog per day, locked before the round
- **Career record and ChaosLedger** contract with per-season Merkle roots and in-browser proof checks
- **Leaderboard and seasons** with weekly seasons, streaks, badges, rivalry of the week and a recap
- **Highlight cards** rendered server-side as share images, with one-tap share to X
- **Status page and health endpoint** for round, seed and RPC health

## Architecture

```
app/                 Next.js App Router: pages and API routes
  api/league         league clock and nudge window (JSON)
  api/nudge          signed nudges: signature + ownership check, one per Chog per day
  api/card/[event]   highlight card image (next/og)
  api/health         health for monitors
components/          Arena canvas, replay panel, profile drawer, wallet UI
lib/engine/          pure engine: PRNG, events, pairing  (shared by server and browser)
lib/genome/          trait to gene decoder and mapping table
lib/server/          chain reads, seeds, rounds, seasons, nudge store
lib/merkle.ts        leaf hashing and proofs (matches ChaosLedger.sol)
contracts/           Foundry project: ChaosLedger, tests, deploy script
tests/               engine, fairness-bound, replay and Merkle tests
scripts/verify.ts    independent event verifier
```

Rounds are derived, not stored. Given the chain and the nudge book, any instance computes the same rounds, which is what makes the league stateless to host and easy to audit.

## Tech stack

Every dependency, listed honestly:

| Library | Use |
| --- | --- |
| [Next.js 15](https://nextjs.org), [React 19](https://react.dev) | App framework, server rendering, `next/og` for cards |
| [viem](https://viem.sh) | Monad RPC reads, message signing and verification, ABI encoding |
| [@noble/hashes](https://github.com/paulmillr/noble-hashes) | keccak256 for seeds, PRNG salt, log hashes |
| [TypeScript](https://www.typescriptlang.org), [tsx](https://tsx.is) | Types and the test runner |
| [Foundry](https://book.getfoundry.sh) / forge-std | ChaosLedger tests and deployment (install separately) |
| Bowlby One, Space Grotesk, JetBrains Mono | Google Fonts through `next/font` |

All code in this repository was written for this hackathon. There is no reused game code. The league logo and wordmark are the supplied brand art; the in-game pixel Chogs are generated procedurally in the logo's style (`lib/sprite.ts`).

## Running it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine, fairness bounds, replay, Merkle
npm run typecheck
```

Optional environment variables are listed in [`.env.example`](.env.example). The app runs fully without them.

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_CHOG_CONTRACT` | Reads Chogs and traits from the collection instead of demo traits |
| `NEXT_PUBLIC_LEDGER_ADDRESS` | Verified badge compares proofs with the on-chain season root |
| `NEXT_PUBLIC_MONAD_RPC`, `NEXT_PUBLIC_MONAD_RPC_BACKUP` | RPC endpoints |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Durable nudge book (Redis REST) |

### ChaosLedger

```bash
cd contracts
forge install foundry-rs/forge-std
forge test
forge script script/Deploy.s.sol --rpc-url https://rpc.monad.xyz --broadcast --private-key $PRIVATE_KEY
```

## Honest limits

- The launch meadow has 48 Chogs. The roster registry, wake-up flow and nudge book move to Postgres in production.
- Until the Chog team confirms the collection address and metadata URL, the app uses clearly labelled **demo traits** and demo adoption. Set `NEXT_PUBLIC_CHOG_CONTRACT` and real metadata decodes through the same table (unknown trait values use a deterministic fallback).
- Nudges use an in-memory store unless Redis is configured. With the in-memory store a restart can drop nudges, which is why durable storage is the production setting.
- ChaosLedger is written and tested; a season root is only shown as **Verified on Monad** once the contract is deployed and the root is written.
- The commentary uses templates. A model can replace them without any change to results.
- No wagering, no price or return promises. The optional $CHOG Snack Shop is not built.

## Roadmap

- Rivalries, revenge events and owner-formed crews
- Chog team events and sponsored seasons (for example a Chogtober week)
- More event types and maps
- Open season data so other builders can make companion apps
- $CHOG cosmetics with capped, non-wagering utility, once the team's guidelines are confirmed

## License

MIT. Chog and Monad names and artwork belong to their respective owners. This is an independent community project.
