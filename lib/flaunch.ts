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
    publicClient: publicClient as any,
    walletClient: walletClient as any,
  }) as any;
}

/**
 * Create a read-only Flaunch SDK instance
 */
export function createFlaunchReadSDK() {
  return createFlaunch({ publicClient: publicClient as any }) as any;
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
 * Uses flaunchIPFSWithRevenueManager so fees auto-split 70/30
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
// FEE CLAIMING (direct viem calls)
// ============================================

const FEE_ESCROW_ADDRESS = "0x72e6f7948b1B1A343B477F39aAbd2E35E6D27dde" as `0x${string}`;

const FEE_ESCROW_ABI = [
  {
    inputs: [{ internalType: "address", name: "_recipient", type: "address" }],
    name: "balances",
    outputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_recipient", type: "address" },
      { internalType: "bool", name: "_unwrap", type: "bool" },
    ],
    name: "withdrawFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const REVENUE_MANAGER_ABI = [
  {
    inputs: [],
    name: "claim",
    outputs: [{ internalType: "uint256", name: "amount_", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_recipient", type: "address" }],
    name: "balances",
    outputs: [{ internalType: "uint256", name: "balance_", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "protocolRecipient",
    outputs: [{ internalType: "address payable", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Check claimable balance for an address via RevenueManager
 * This calls the RevenueManager which internally checks FeeEscrow + pending
 */
export async function getCreatorClaimableBalance(
  creatorAddress: `0x${string}`
): Promise<bigint> {
  if (!REVENUE_MANAGER_ADDRESS) return BigInt(0);
  try {
    const balance = await publicClient.readContract({
      address: REVENUE_MANAGER_ADDRESS,
      abi: REVENUE_MANAGER_ABI,
      functionName: "balances",
      args: [creatorAddress],
    });
    return balance as bigint;
  } catch (err) {
    console.warn("RevenueManager balances() error:", err);
    // Fallback: check FeeEscrow for the RevenueManager address
    try {
      return await publicClient.readContract({
        address: FEE_ESCROW_ADDRESS,
        abi: FEE_ESCROW_ABI,
        functionName: "balances",
        args: [REVENUE_MANAGER_ADDRESS],
      }) as bigint;
    } catch {
      return BigInt(0);
    }
  }
}

/**
 * Check how much ETH the platform can claim
 */
export async function getPlatformClaimableBalance(): Promise<bigint> {
  if (!REVENUE_MANAGER_ADDRESS) return BigInt(0);
  try {
    const balance = await publicClient.readContract({
      address: REVENUE_MANAGER_ADDRESS,
      abi: REVENUE_MANAGER_ABI,
      functionName: "balances",
      args: [ALIFE_TREASURY],
    });
    return balance as bigint;
  } catch {
    // Fallback: check FeeEscrow for the RevenueManager address
    try {
      return await publicClient.readContract({
        address: FEE_ESCROW_ADDRESS,
        abi: FEE_ESCROW_ABI,
        functionName: "balances",
        args: [REVENUE_MANAGER_ADDRESS],
      }) as bigint;
    } catch {
      return BigInt(0);
    }
  }
}

/**
 * Creator claims their 70% fees via RevenueManager
 * The RM internally pulls from FeeEscrow and distributes
 */
export async function claimCreatorFees(walletClient: WalletClient): Promise<`0x${string}`> {
  if (!REVENUE_MANAGER_ADDRESS) throw new Error("RevenueManager not deployed");
  const [account] = await walletClient.getAddresses();

  const hash = await walletClient.writeContract({
    address: REVENUE_MANAGER_ADDRESS,
    abi: REVENUE_MANAGER_ABI,
    functionName: "claim",
    account,
    chain: base,
  });

  return hash;
}

/**
 * Platform claims its 30% via RevenueManager
 * Must be called by the protocolRecipient wallet (0xa660...)
 */
export async function claimPlatformFees(walletClient: WalletClient): Promise<`0x${string}`> {
  if (!REVENUE_MANAGER_ADDRESS) throw new Error("RevenueManager not deployed");
  const [account] = await walletClient.getAddresses();

  const hash = await walletClient.writeContract({
    address: REVENUE_MANAGER_ADDRESS,
    abi: REVENUE_MANAGER_ABI,
    functionName: "claim",
    account,
    chain: base,
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
