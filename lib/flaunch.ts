// @ts-nocheck
/**
 * Alive Agents v2 × Flaunch Integration
 * 
 * Simple approach:
 * - flaunchIPFS() deploys tokens (proven working)
 * - Platform wallet receives the Flaunch NFT + all trading fees
 * - Creator payouts tracked in Supabase, paid out separately
 * - Fees queried via Flaunch REST API per token
 */

import { createFlaunch } from "@flaunch/sdk";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// ============================================
// CONFIG
// ============================================

const ALIFE_TREASURY = (process.env.NEXT_PUBLIC_ALIFE_TREASURY || "0xA660a38f40a519F2E351Cc9A5CA2f5feE1a9BE0D");
const FLAUNCH_API = "https://api.flaunch.gg";

// ============================================
// CLIENT SETUP
// ============================================

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
});

export function createFlaunchSDK(walletClient) {
  return createFlaunch({ publicClient, walletClient });
}

export function createFlaunchReadSDK() {
  return createFlaunch({ publicClient });
}

// ============================================
// LAUNCH — simple flaunchIPFS, platform gets NFT
// ============================================

export async function flaunchAgentToken(walletClient, params) {
  const flaunch = createFlaunchSDK(walletClient);
  const flaunchRead = createFlaunchReadSDK();

  const launchParams = {
    name: params.name,
    symbol: params.symbol,
    creator: ALIFE_TREASURY,           // Platform wallet gets NFT + fees
    creatorFeeAllocationPercent: 100,   // 100% of swap fees go to NFT holder (us)
    fairLaunchPercent: 0,
    fairLaunchDuration: 30 * 60,
    initialMarketCapUSD: params.initialMarketCapUSD ?? 1000,
    metadata: {
      base64Image: params.imageBase64,
      description: params.description,
    },
  };

  console.log("[flaunch] Launching with params:", JSON.stringify({
    ...launchParams,
    metadata: { ...launchParams.metadata, base64Image: launchParams.metadata.base64Image?.slice(0, 50) + "..." },
  }, null, 2));

  const hash = await flaunch.flaunchIPFS(launchParams);

  const poolData = await flaunchRead.getPoolCreatedFromTx(hash);
  if (!poolData) {
    throw new Error("Failed to parse flaunch transaction");
  }

  return {
    txHash: hash,
    memecoinAddress: poolData.memecoin,
    tokenId: Number(poolData.tokenId),
    poolAddress: poolData.poolAddress || null,
    splitManagerAddress: null,
  };
}

// ============================================
// FEE TRACKING — query accumulated fees per token
// ============================================

/**
 * Get total fees earned by a token from Flaunch API
 * Returns fees in ETH (as a number)
 */
export async function getTokenFees(tokenAddress) {
  try {
    const res = await fetch(`${FLAUNCH_API}/v1/coins/${tokenAddress}?chainId=8453`);
    if (!res.ok) return { totalFees: 0, claimableFees: 0 };
    const data = await res.json();
    return {
      totalFees: parseFloat(data.totalFees || data.total_fees || "0"),
      claimableFees: parseFloat(data.claimableFees || data.claimable_fees || "0"),
    };
  } catch (err) {
    console.error("[flaunch] Failed to fetch token fees:", err);
    return { totalFees: 0, claimableFees: 0 };
  }
}

/**
 * Calculate creator's share of fees for an agent
 * Default: creator gets 70%, platform keeps 30%
 */
export function calculateCreatorShare(totalFees, creatorPct = 70) {
  const creatorShare = (totalFees * creatorPct) / 100;
  const platformShare = totalFees - creatorShare;
  return { creatorShare, platformShare };
}

/**
 * Get fee summary for an agent (for UI display)
 */
export async function getAgentFeeSummary(tokenAddress, creatorPct = 70) {
  const { totalFees, claimableFees } = await getTokenFees(tokenAddress);
  const { creatorShare, platformShare } = calculateCreatorShare(totalFees, creatorPct);
  return {
    totalFeesETH: totalFees,
    claimableFeesETH: claimableFees,
    creatorShareETH: creatorShare,
    platformShareETH: platformShare,
    creatorPct,
    platformPct: 100 - creatorPct,
  };
}

// ============================================
// PLATFORM FEE CLAIMING (NFT holder claims all)
// ============================================

/**
 * Claim all accumulated fees for a token
 * Must be called by the NFT holder (platform wallet)
 * Uses SDK's withdrawCreatorRevenue — sends fees to connected wallet
 */
export async function claimPlatformFees(walletClient, tokenAddress) {
  const flaunch = createFlaunchSDK(walletClient);
  try {
    // withdrawCreatorRevenue sends all accumulated fees to the connected wallet
    // The platform wallet is the NFT holder, so it can call this
    const hash = await flaunch.withdrawCreatorRevenue({
      recipient: ALIFE_TREASURY,
    });
    return hash;
  } catch (err) {
    console.error("[flaunch] Claim failed:", err);
    throw err;
  }
}

// ============================================
// CREATOR CLAIM HELPERS (for agent page UI)
// ============================================

/**
 * Get how much a creator can claim for their agent
 * Since platform wallet holds the NFT, this queries Flaunch API
 * and returns the creator's 70% share
 */
export async function getCreatorClaimableBalance(
  _creatorAddress: `0x${string}`,
  tokenAddressOrSplitManager: `0x${string}`
): Promise<bigint> {
  try {
    const { claimableFees } = await getTokenFees(tokenAddressOrSplitManager);
    const creatorShare = (claimableFees * 70) / 100;
    // Convert ETH float to wei bigint
    const wei = BigInt(Math.floor(creatorShare * 1e18));
    return wei;
  } catch {
    return BigInt(0);
  }
}

/**
 * Creator fee claiming — in this model the platform claims all and pays creators
 * This is a no-op placeholder that shows the creator their pending balance
 */
export async function claimCreatorFees(
  _walletClient: any,
  _tokenAddressOrSplitManager: `0x${string}`
): Promise<string> {
  throw new Error(
    "Creator fees are paid out by the platform. Your pending balance is tracked automatically — payouts are sent to your wallet periodically."
  );
}

/**
 * Get platform's claimable balance for a token (for admin page)
 */
export async function getPlatformClaimableBalance(
  tokenAddressOrSplitManager: `0x${string}`
): Promise<bigint> {
  try {
    const { claimableFees } = await getTokenFees(tokenAddressOrSplitManager);
    const wei = BigInt(Math.floor(claimableFees * 1e18));
    return wei;
  } catch {
    return BigInt(0);
  }
}

// ============================================
// READ HELPERS
// ============================================

export async function getTokenMetadata(coinAddress) {
  const flaunchRead = createFlaunchReadSDK();
  return flaunchRead.getCoinMetadata(coinAddress);
}

export function getTreasuryAddress() {
  return ALIFE_TREASURY;
}

// Legacy compat — launch.ts checks this
export function getRevenueManagerAddress() {
  return ALIFE_TREASURY;
}

export function deployRevenueManager() {
  throw new Error("Not needed — using simple flaunchIPFS now");
}
