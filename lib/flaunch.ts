/**
 * Alive Agents v2 × Flaunch Integration
 * 
 * Uses @flaunch/sdk to:
 * 1. Deploy a RevenueManager (one-time, sets fee split)
 * 2. Flaunch tokens into the RevenueManager on behalf of creators
 * 3. Check balances and claim fees
 * 
 * Install: npm install @flaunch/sdk viem
 */

import { createFlaunch, type ReadWriteFlaunchSDK, FlaunchAddress, FlaunchV1_1Address } from "@flaunch/sdk";
import { createPublicClient, createWalletClient, http, custom, type WalletClient, type PublicClient } from "viem";
import { base } from "viem/chains";

// Type for parsed pool creation data
interface PoolCreatedEventData {
  memecoin: string;
  tokenId: bigint;
  [key: string]: any;
}

// ============================================
// CONFIG
// ============================================

// Platform treasury — receives protocol fees
const ALIFE_TREASURY = process.env.NEXT_PUBLIC_ALIFE_TREASURY as `0x${string}`;
const ALIFE_PROTOCOL_FEE_PERCENT = 30;

// RevenueManager deployed on Base mainnet
let REVENUE_MANAGER_ADDRESS: `0x${string}` | null = 
  (process.env.NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS as `0x${string}`) || null;

// ============================================
// CLIENT SETUP
// ============================================

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
});

/**
 * Create a Flaunch SDK instance with write capabilities
 * Pass the walletClient from Privy
 */
export function createFlaunchSDK(walletClient: WalletClient) {
  return createFlaunch({
    publicClient,
    walletClient,
  }) as any; // SDK types may vary between versions
}

/**
 * Create a read-only Flaunch SDK instance
 */
export function createFlaunchReadSDK() {
  return createFlaunch({ publicClient });
}

// ============================================
// ONE-TIME SETUP: Deploy RevenueManager
// ============================================

/**
 * Deploy ALiFe's RevenueManager contract (call once, then store the address)
 * This sets up the 70/30 split: 70% creator, 30% ALiFe
 */
export async function deployRevenueManager(walletClient: WalletClient): Promise<`0x${string}`> {
  const flaunch = createFlaunchSDK(walletClient);
  
  const revenueManagerAddress = await flaunch.deployRevenueManager({
    protocolRecipient: ALIFE_TREASURY,
    protocolFeePercent: ALIFE_PROTOCOL_FEE_PERCENT,
  });

  REVENUE_MANAGER_ADDRESS = revenueManagerAddress as `0x${string}`;
  console.log("RevenueManager deployed at:", revenueManagerAddress);
  
  // IMPORTANT: Store this address in your env vars / database
  // You only need to deploy this ONCE
  return revenueManagerAddress as `0x${string}`;
}

// ============================================
// LAUNCH: Flaunch a token for a new agent
// ============================================

export interface LaunchAgentTokenParams {
  name: string;
  symbol: string;
  description: string;
  imageBase64: string; // base64 encoded image from user upload
  creatorAddress: `0x${string}`;
  initialMarketCapUSD?: number;
  creatorFeeAllocationPercent?: number;
  fairLaunchDurationSeconds?: number;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
}

export interface LaunchResult {
  txHash: `0x${string}`;
  memecoinAddress: `0x${string}`;
  tokenId: number;
  poolAddress: `0x${string}` | null;
}

/**
 * Flaunch a token for a new Alive Agent
 * Uses flaunchIPFSWithRevenueManager so fees auto-split
 */
export async function flaunchAgentToken(
  walletClient: WalletClient,
  params: LaunchAgentTokenParams
): Promise<LaunchResult> {
  if (!REVENUE_MANAGER_ADDRESS) {
    throw new Error("RevenueManager not deployed. Call deployRevenueManager() first.");
  }

  const flaunch = createFlaunchSDK(walletClient);
  const flaunchRead = createFlaunchReadSDK();

  // Use flaunchIPFSWithRevenueManager — NFT goes to RevenueManager for auto fee split
  const hash = await flaunch.flaunchIPFSWithRevenueManager({
    name: params.name,
    symbol: params.symbol,
    creator: params.creatorAddress,
    creatorFeeAllocationPercent: params.creatorFeeAllocationPercent ?? 80,
    fairLaunchPercent: 0,
    fairLaunchDuration: params.fairLaunchDurationSeconds ?? 30 * 60,
    initialMarketCapUSD: params.initialMarketCapUSD ?? 10_000,
    revenueManagerInstanceAddress: REVENUE_MANAGER_ADDRESS,
    metadata: {
      base64Image: params.imageBase64,
      description: params.description,
      websiteUrl: params.websiteUrl,
      twitterUrl: params.twitterUrl,
      telegramUrl: params.telegramUrl,
    },
  });

  // Parse the transaction to get token details
  const poolData = await flaunchRead.getPoolCreatedFromTx(hash) as PoolCreatedEventData | null;

  if (!poolData) {
    throw new Error("Failed to parse flaunch transaction");
  }

  return {
    txHash: hash,
    memecoinAddress: poolData.memecoin as `0x${string}`,
    tokenId: Number(poolData.tokenId),
    poolAddress: (poolData as any).poolAddress || null,
  };
}

// ============================================
// FEE CLAIMING
// ============================================

/**
 * Check how much ETH a creator can claim from their agent tokens
 */
export async function getCreatorClaimableBalance(
  creatorAddress: `0x${string}`
): Promise<bigint> {
  if (!REVENUE_MANAGER_ADDRESS) return 0n;
  
  const flaunchRead = createFlaunchReadSDK();
  const balance = await flaunchRead.revenueManagerBalance({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
    recipient: creatorAddress,
  });

  return balance;
}

/**
 * Check how much ETH ALiFe platform can claim
 */
export async function getPlatformClaimableBalance(): Promise<bigint> {
  if (!REVENUE_MANAGER_ADDRESS) return 0n;
  
  const flaunchRead = createFlaunchReadSDK();
  const balance = await flaunchRead.revenueManagerBalance({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
    recipient: ALIFE_TREASURY,
  });

  return balance;
}

/**
 * Creator claims their 70% of accumulated fees (in ETH)
 */
export async function claimCreatorFees(walletClient: WalletClient): Promise<`0x${string}`> {
  if (!REVENUE_MANAGER_ADDRESS) {
    throw new Error("RevenueManager not deployed");
  }

  const flaunch = createFlaunchSDK(walletClient);
  const hash = await flaunch.revenueManagerCreatorClaim({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
  });

  return hash;
}

/**
 * Creator claims fees for specific token IDs
 */
export async function claimCreatorFeesForTokens(
  walletClient: WalletClient,
  tokenIds: number[]
): Promise<`0x${string}`> {
  if (!REVENUE_MANAGER_ADDRESS) {
    throw new Error("RevenueManager not deployed");
  }

  const flaunch = createFlaunchSDK(walletClient);
  const hash = await flaunch.revenueManagerCreatorClaimForTokens({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
    flaunchTokens: tokenIds.map(id => ({
      flaunch: FlaunchV1_1Address[base.id],
      tokenId: id,
    })),
  });

  return hash;
}

/**
 * ALiFe platform claims its 30% cut
 * (Only callable by ALIFE_TREASURY wallet)
 */
export async function claimPlatformFees(walletClient: WalletClient): Promise<`0x${string}`> {
  if (!REVENUE_MANAGER_ADDRESS) {
    throw new Error("RevenueManager not deployed");
  }

  const flaunch = createFlaunchSDK(walletClient);
  const hash = await flaunch.revenueManagerProtocolClaim({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
  });

  return hash;
}

// ============================================
// READ HELPERS
// ============================================

/**
 * Get token metadata (name, symbol, image) for a flaunched coin
 */
export async function getTokenMetadata(coinAddress: `0x${string}`) {
  const flaunchRead = createFlaunchReadSDK();
  return flaunchRead.getCoinMetadata(coinAddress);
}

/**
 * Get the RevenueManager address (for display purposes)
 */
export function getRevenueManagerAddress(): `0x${string}` | null {
  return REVENUE_MANAGER_ADDRESS;
}
