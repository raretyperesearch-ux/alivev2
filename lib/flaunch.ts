// @ts-nocheck
/**
 * ALiFe × Flaunch Integration
 * 
 * Uses @flaunch/sdk to:
 * 1. Deploy a RevenueManager (one-time, sets ALiFe's 30% cut)
 * 2. Flaunch tokens into the RevenueManager on behalf of creators
 * 3. Check balances and claim fees
 */

import { createFlaunch, FlaunchAddress, FlaunchV1_1Address } from "@flaunch/sdk";
import { createPublicClient, createWalletClient, http, custom } from "viem";
import { base } from "viem/chains";

// ============================================
// CONFIG
// ============================================

const ALIFE_TREASURY = process.env.NEXT_PUBLIC_ALIFE_TREASURY;
const ALIFE_PROTOCOL_FEE_PERCENT = 30;

let REVENUE_MANAGER_ADDRESS =
  process.env.NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS || null;

// ============================================
// CLIENT SETUP
// ============================================

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
});

export function createFlaunchSDK(walletClient) {
  return createFlaunch({
    publicClient,
    walletClient,
  });
}

export function createFlaunchReadSDK() {
  return createFlaunch({ publicClient });
}

// ============================================
// ONE-TIME SETUP: Deploy RevenueManager
// ============================================

export async function deployRevenueManager(walletClient) {
  const flaunch = createFlaunchSDK(walletClient);
  
  const revenueManagerAddress = await flaunch.deployRevenueManager({
    protocolRecipient: ALIFE_TREASURY,
    protocolFeePercent: ALIFE_PROTOCOL_FEE_PERCENT,
  });

  REVENUE_MANAGER_ADDRESS = revenueManagerAddress;
  console.log("RevenueManager deployed at:", revenueManagerAddress);
  return revenueManagerAddress;
}

// ============================================
// LAUNCH: Flaunch a token for a new agent
// ============================================

export async function flaunchAgentToken(walletClient, params) {
  if (!REVENUE_MANAGER_ADDRESS) {
    throw new Error("RevenueManager not deployed. Call deployRevenueManager() first.");
  }

  const flaunch = createFlaunchSDK(walletClient);
  const flaunchRead = createFlaunchReadSDK();

  const hash = await flaunch.flaunchIPFS({
    name: params.name,
    symbol: params.symbol,
    creator: REVENUE_MANAGER_ADDRESS,
    creatorFeeAllocationPercent: params.creatorFeeAllocationPercent ?? 80,
    fairLaunchPercent: 0,
    fairLaunchDuration: params.fairLaunchDurationSeconds ?? 30 * 60,
    initialMarketCapUSD: params.initialMarketCapUSD ?? 10_000,
    metadata: {
      base64Image: params.imageBase64,
      description: params.description,
      websiteUrl: params.websiteUrl,
      twitterUrl: params.twitterUrl,
      telegramUrl: params.telegramUrl,
    },
  });

  const poolData = await flaunchRead.getPoolCreatedFromTx(hash);

  if (!poolData) {
    throw new Error("Failed to parse flaunch transaction");
  }

  return {
    txHash: hash,
    memecoinAddress: poolData.memecoin,
    tokenId: Number(poolData.tokenId),
    poolAddress: poolData.poolAddress || null,
  };
}

// ============================================
// FEE CLAIMING
// ============================================

export async function getCreatorClaimableBalance(creatorAddress) {
  if (!REVENUE_MANAGER_ADDRESS) return 0n;
  const flaunchRead = createFlaunchReadSDK();
  return flaunchRead.revenueManagerBalance({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
    recipient: creatorAddress,
  });
}

export async function getPlatformClaimableBalance() {
  if (!REVENUE_MANAGER_ADDRESS) return 0n;
  const flaunchRead = createFlaunchReadSDK();
  return flaunchRead.revenueManagerBalance({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
    recipient: ALIFE_TREASURY,
  });
}

export async function claimCreatorFees(walletClient) {
  if (!REVENUE_MANAGER_ADDRESS) throw new Error("RevenueManager not deployed");
  const flaunch = createFlaunchSDK(walletClient);
  return flaunch.revenueManagerCreatorClaim({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
  });
}

export async function claimCreatorFeesForTokens(walletClient, tokenIds) {
  if (!REVENUE_MANAGER_ADDRESS) throw new Error("RevenueManager not deployed");
  const flaunch = createFlaunchSDK(walletClient);
  return flaunch.revenueManagerCreatorClaimForTokens({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
    flaunchTokens: tokenIds.map((id) => ({
      flaunch: FlaunchV1_1Address[base.id],
      tokenId: id,
    })),
  });
}

export async function claimPlatformFees(walletClient) {
  if (!REVENUE_MANAGER_ADDRESS) throw new Error("RevenueManager not deployed");
  const flaunch = createFlaunchSDK(walletClient);
  return flaunch.revenueManagerProtocolClaim({
    revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
  });
}

// ============================================
// READ HELPERS
// ============================================

export async function getTokenMetadata(coinAddress) {
  const flaunchRead = createFlaunchReadSDK();
  return flaunchRead.getCoinMetadata(coinAddress);
}

export function getRevenueManagerAddress() {
  return REVENUE_MANAGER_ADDRESS;
}
