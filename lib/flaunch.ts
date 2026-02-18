// @ts-nocheck
/**
 * Alive Agents v2 × Flaunch Integration
 * 
 * Uses @flaunch/sdk with AddressFeeSplitManager:
 * - Each token launch creates its own split manager
 * - Creator gets 70%, platform treasury gets 30%
 * - Each address claims independently with claim()
 * - No separate RevenueManager deploy needed
 * 
 * Install: npm install @flaunch/sdk viem
 */

import { createFlaunch, type ReadWriteFlaunchSDK } from "@flaunch/sdk";
import { createPublicClient, http, type WalletClient } from "viem";
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

// Platform treasury — receives 30% of fees
const ALIFE_TREASURY = (process.env.NEXT_PUBLIC_ALIFE_TREASURY || "0xA660a38f40a519F2E351Cc9A5CA2f5feE1a9BE0D") as `0x${string}`;

// ============================================
// CLIENT SETUP
// ============================================

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
});

/**
 * Create a Flaunch SDK instance with write capabilities
 */
export function createFlaunchSDK(walletClient) {
  return createFlaunch({
    publicClient: publicClient,
    walletClient: walletClient,
  });
}

/**
 * Create a read-only Flaunch SDK instance
 */
export function createFlaunchReadSDK() {
  return createFlaunch({ publicClient: publicClient });
}

// ============================================
// LAUNCH: Flaunch a token with SplitManager
// ============================================

export interface LaunchAgentTokenParams {
  name: string;
  symbol: string;
  description: string;
  imageBase64: string;
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
  splitManagerAddress: `0x${string}` | null;
}

/**
 * Flaunch a token for a new Alive Agent
 * Uses flaunchIPFSWithSplitManager — no RevenueManager needed
 * Creator gets 70% of fees, ALiFe treasury gets 30%
 */
export async function flaunchAgentToken(
  walletClient,
  params: LaunchAgentTokenParams
): Promise<LaunchResult> {
  const flaunch = createFlaunchSDK(walletClient);
  const flaunchRead = createFlaunchReadSDK();

  const launchParams = {
    name: params.name,
    symbol: params.symbol,
    creator: params.creatorAddress,
    creatorFeeAllocationPercent: 100,
    fairLaunchPercent: 0,
    fairLaunchDuration: 30 * 60,
    initialMarketCapUSD: params.initialMarketCapUSD ?? 1000,
    // Split: 70% creator, 0% manager owner, 30% platform
    // SDK requires managerOwnerSplitPercent (undocumented but required in v0.9.15)
    creatorSplitPercent: 70,
    managerOwnerSplitPercent: 0,
    splitReceivers: [
      {
        address: ALIFE_TREASURY,
        percent: 30,
      },
    ],
    metadata: {
      base64Image: params.imageBase64,
      description: params.description,
    },
  };

  console.log("[flaunch] Launch params:", JSON.stringify({
    ...launchParams,
    metadata: { ...launchParams.metadata, base64Image: launchParams.metadata.base64Image?.slice(0, 50) + "..." },
  }, null, 2));

  const hash = await flaunch.flaunchIPFSWithSplitManager(launchParams);

  // Parse the transaction to get token details
  const poolData = await flaunchRead.getPoolCreatedFromTx(hash);

  if (!poolData) {
    throw new Error("Failed to parse flaunch transaction");
  }

  return {
    txHash: hash,
    memecoinAddress: poolData.memecoin,
    tokenId: Number(poolData.tokenId),
    poolAddress: poolData.poolAddress || null,
    splitManagerAddress: poolData.managerAddress || poolData.treasuryManager || null,
  };
}

// ============================================
// FEE CLAIMING (AddressFeeSplitManager)
// ============================================

const SPLIT_MANAGER_ABI = [
  {
    inputs: [{ internalType: "address", name: "_recipient", type: "address" }],
    name: "balances",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "claim",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "managerFees",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "creatorFees",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Check claimable balance for an address on a specific SplitManager
 */
export async function getSplitManagerBalance(splitManagerAddress, recipient) {
  try {
    return await publicClient.readContract({
      address: splitManagerAddress,
      abi: SPLIT_MANAGER_ABI,
      functionName: "balances",
      args: [recipient],
    });
  } catch {
    return BigInt(0);
  }
}

/**
 * Check claimable balance for creator
 */
export async function getCreatorClaimableBalance(creatorAddress, splitManagerAddress) {
  if (!splitManagerAddress) return BigInt(0);
  return getSplitManagerBalance(splitManagerAddress, creatorAddress);
}

/**
 * Check how much ETH the platform can claim from a SplitManager
 */
export async function getPlatformClaimableBalance(splitManagerAddress) {
  if (!splitManagerAddress) return BigInt(0);
  return getSplitManagerBalance(splitManagerAddress, ALIFE_TREASURY);
}

/**
 * Claim fees from a SplitManager
 * Any valid recipient (creator or split receiver) can call this
 */
export async function claimFees(walletClient, splitManagerAddress) {
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: splitManagerAddress,
    abi: SPLIT_MANAGER_ABI,
    functionName: "claim",
    account,
    chain: base,
  });
  return hash;
}

/**
 * Convenience: claim creator fees
 */
export async function claimCreatorFees(walletClient, splitManagerAddress) {
  if (!splitManagerAddress) throw new Error("No SplitManager address");
  return claimFees(walletClient, splitManagerAddress);
}

/**
 * Convenience: claim platform fees
 */
export async function claimPlatformFees(walletClient, splitManagerAddress) {
  if (!splitManagerAddress) throw new Error("No SplitManager address");
  return claimFees(walletClient, splitManagerAddress);
}

// ============================================
// READ HELPERS
// ============================================

/**
 * Get token metadata (name, symbol, image) for a flaunched coin
 */
export async function getTokenMetadata(coinAddress) {
  const flaunchRead = createFlaunchReadSDK();
  return flaunchRead.getCoinMetadata(coinAddress);
}

/**
 * Get the treasury address
 */
export function getTreasuryAddress() {
  return ALIFE_TREASURY;
}

// Legacy exports for backward compat with launch.ts
export function deployRevenueManager(_walletClient) {
  throw new Error("RevenueManager is deprecated. Using AddressFeeSplitManager now — no deploy needed.");
}

export function getRevenueManagerAddress() {
  return null;
}
