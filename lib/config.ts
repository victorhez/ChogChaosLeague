export const CHAIN = { id: 143, name: "Monad", explorer: "https://monadscan.com" } as const;

/** League clock is chain-driven: round r is seeded by the hash of block ANCHOR_BLOCK + r * BLOCKS_PER_ROUND. */
export const BLOCKS_PER_ROUND = 9_000; // about one hour at Monad's ~0.4s block time
export const ROUNDS_PER_DAY = 24;
export const ROUNDS_PER_SEASON = 168; // one week
/** Season 1 (round 168) starts at block 113,030,000, the moment the real-collection league went live. */
export const ANCHOR_BLOCK = 113_030_000 - ROUNDS_PER_SEASON * BLOCKS_PER_ROUND;
/** Rounds before this one are replayed history: computed from past blocks, no owner ever nudged them. */
export const LIVE_FROM_ROUND = ROUNDS_PER_SEASON;
/** A seed block is only used once it is this many blocks behind head. */
export const FINALITY_BLOCKS = 200;
/** Nudges lock this many blocks before the seed block exists. */
export const LOCK_BLOCKS = 450;
export const BLOCK_SECONDS = 0.4;

/** Chog Genesis (ERC-721, Monad mainnet). Token ids run 1..1969. */
export const DEFAULT_CHOG_CONTRACT = "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763";
export const CHOG_CONTRACT = (process.env.NEXT_PUBLIC_CHOG_CONTRACT || DEFAULT_CHOG_CONTRACT) as `0x${string}`;
export const COLLECTION_SIZE = 1969;
export const LEDGER_ADDRESS = (process.env.NEXT_PUBLIC_LEDGER_ADDRESS || "") as `0x${string}` | "";

export const RPC_URLS = [
  process.env.NEXT_PUBLIC_MONAD_RPC || "https://rpc.monad.xyz",
  process.env.NEXT_PUBLIC_MONAD_RPC_BACKUP || "https://rpc1.monad.xyz",
].filter(Boolean);

export const REPO_URL = "https://github.com/victorhez/ChogChaosLeague";

export const roundSeedBlock = (r: number) => ANCHOR_BLOCK + r * BLOCKS_PER_ROUND;
export const seasonOf = (r: number) => Math.floor(r / ROUNDS_PER_SEASON);
export const dayOf = (r: number) => Math.floor(r / ROUNDS_PER_DAY);
export const isHistory = (r: number) => r < LIVE_FROM_ROUND;
/** Index of the newest round whose seed block is final at head `latest`. */
export const lastClosedRound = (latest: number) => Math.floor((latest - FINALITY_BLOCKS - ANCHOR_BLOCK) / BLOCKS_PER_ROUND);

/** Transactions that wrote each season root to ChaosLedger on Monad, so a Verified badge can link to the proof of anchoring. */
export const ANCHOR_TXS: Record<number, string> = {
  0: "0x7915194a0a68213e3433f90650fa991df27c244a977fda9fdf4635bd2249f546",
};
