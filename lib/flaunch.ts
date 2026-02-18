/**
 * Alive Agents v2 × Flaunch Integration
 * 
 * Uses @flaunch/sdk with AddressFeeSplitManager:
 * - Each token launch creates its own split manager
 * - Creator gets 70%, platform treasury gets 30%
 * - Each address claims independently with claim()
 * - No separate RevenueManager deploy needed
 * 
 * NOTE: We bypass flaunchIPFSWithSplitManager() due to an SDK bug where
 * it encodes an `ownerShare` field that the contract doesn't expect,
 * causing revert #1002. Instead we encode initializeData ourselves
 * and call flaunchIPFS() with treasuryManagerParams directly.
 * 
 * Install: npm install @flaunch/sdk viem
 */

import { createFlaunch, type ReadWriteFlaunchSDK } from "@flaunch/sdk";
import { createPublicClient, http, encodeAbiParameters, type WalletClient } from "viem";
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

// AddressFeeSplitManager on Base (from SDK addresses.ts)
const ADDRESS_FEE_SPLIT_MANAGER = "0xfAB4BA48a322Efc8b25815448BE6018D211e89f3" as `0x${string}`;

// 5 decimal precision: 100% = 10_000_000
const VALID_SHARE_TOTAL = BigInt(10000000);

// Creator gets 70%, platform gets 30%
const CREATOR_SHARE_PERCENT = 70;
const PLATFORM_SHARE_PERCENT = 30;

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
 * Encode initializeData for AddressFeeSplitManager
 * Matches the contract's actual InitializeParams struct:
 *   struct InitializeParams {
 *     uint creatorShare;          // 5dp percentage
 *     RecipientShare[] recipientShares;
 *   }
 *   struct RecipientShare {
 *     address recipient;
 *     uint share;                 // 5dp percentage
 *   }
 * 
 * NOTE: The SDK's flaunchWithSplitManager() encodes an extra `ownerShare`
 * field that doesn't exist in the contract struct, causing revert #1002.
 * This function encodes it correctly.
 */
function encodeAddressFeeSplitInitData(
  creatorSharePercent: number,
  recipients: { address: `0x${string}`; percent: number }[]
): `0x${string}` {
  const creatorShare = (BigInt(creatorSharePercent) * VALID_SHARE_TOTAL) / BigInt(100);

  const recipientShares = recipients.map((r) => ({
    recipient: r.address,
    share: (BigInt(r.percent) * VALID_SHARE_TOTAL) / BigInt(100),
  }));

  return encodeAbiParameters(
    [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "uint256", name: "creatorShare" },
          {
            type: "tuple[]",
            name: "recipientShares",
            components: [
              { type: "address", name: "recipient" },
              { type: "uint256", name: "share" },
            ],
          },
        ],
      },
    ],
    [
      {
        creatorShare,
        recipientShares,
      },
    ]
  );
}

/**
 * Flaunch a token for a new Alive Agent
 * 
 * Bypasses flaunchIPFSWithSplitManager (SDK bug) and instead calls
 * flaunchIPFS with manually encoded treasuryManagerParams.
 * 
 * Creator gets 70% of fees, ALiFe treasury gets 30%
 */
export async function flaunchAgentToken(
  walletClient: WalletClient,
  params: LaunchAgentTokenParams
): Promise<LaunchResult> {
  const flaunch = createFlaunchSDK(walletClient);
  const flaunchRead = createFlaunchReadSDK();

  // Encode the split manager init data ourselves (bypassing SDK bug)
  const initializeData = encodeAddressFeeSplitInitData(
    CREATOR_SHARE_PERCENT, // 70% to creator
    [{ address: ALIFE_TREASURY, percent: PLATFORM_SHARE_PERCENT }] // 30% to platform
  );

  const launchParams = {
    name: params.name,
    symbol: params.symbol,
    creator: params.creatorAddress,
    creatorFeeAllocationPercent: 100,
    fairLaunchPercent: 0,
    fairLaunchDuration: 30 * 60,
    initialMarketCapUSD: params.initialMarketCapUSD ?? 1_000,
    metadata: {
      base64Image: params.imageBase64,
      description: params.description,
    },
    // Pass the split manager directly via treasuryManagerParams
    treasuryManagerParams: {
      manager: ADDRESS_FEE_SPLIT_MANAGER,
      initializeData,
      depositData: "0x" as `0x${string}`,
    },
  };

  console.log("[flaunch] Launch params:", JSON.stringify({
    ...launchParams,
    metadata: { ...launchParams.metadata, base64Image: launchParams.metadata.base64Image?.slice(0, 50) + "..." },
  }, null, 2));

  // Use flaunchIPFS (not flaunchIPFSWithSplitManager) with our own treasuryManagerParams
  const hash = await flaunch.flaunchIPFS(launchParams);

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
    splitManagerAddress: (poolData as any).managerAddress || (poolData as any).treasuryManager || null,
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
export async function getSplitManagerBalance(
  splitManagerAddress: `0x${string}`,
  recipient: `0x${string}`
): Promise<bigint> {
  try {
    return await publicClient.readContract({
      address: splitManagerAddress,
      abi: SPLIT_MANAGER_ABI,
      functionName: "balances",
      args: [recipient],
    }) as bigint;
  } catch {
    return BigInt(0);
  }
}

/**
 * Check claimable balance for creator
 */
export async function getCreatorClaimableBalance(
  creatorAddress: `0x${string}`,
  splitManagerAddress?: `0x${string}`
): Promise<bigint> {
  if (!splitManagerAddress) return BigInt(0);
  return getSplitManagerBalance(splitManagerAddress, creatorAddress);
}

/**
 * Check how much ETH the platform can claim from a SplitManager
 */
export async function getPlatformClaimableBalance(
  splitManagerAddress?: `0x${string}`
): Promise<bigint> {
  if (!splitManagerAddress) return BigInt(0);
  return getSplitManagerBalance(splitManagerAddress, ALIFE_TREASURY);
}

/**
 * Claim fees from a SplitManager
 * Any valid recipient (creator or split receiver) can call this
 */
export async function claimFees(
  walletClient: WalletClient,
  splitManagerAddress: `0x${string}`
): Promise<`0x${string}`> {
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
export async function claimCreatorFees(
  walletClient: WalletClient,
  splitManagerAddress?: `0x${string}`
): Promise<`0x${string}`> {
  if (!splitManagerAddress) throw new Error("No SplitManager address");
  return claimFees(walletClient, splitManagerAddress);
}

/**
 * Convenience: claim platform fees
 */
export async function claimPlatformFees(
  walletClient: WalletClient,
  splitManagerAddress?: `0x${string}`
): Promise<`0x${string}`> {
  if (!splitManagerAddress) throw new Error("No SplitManager address");
  return claimFees(walletClient, splitManagerAddress);
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
 * Get the treasury address
 */
export function getTreasuryAddress(): `0x${string}` {
  return ALIFE_TREASURY;
}

// Legacy exports for backward compat
export function deployRevenueManager(_walletClient: WalletClient): Promise<`0x${string}`> {
  throw new Error("RevenueManager is deprecated. Using AddressFeeSplitManager now — no deploy needed.");
}

export function getRevenueManagerAddress(): `0x${string}` | null {
  return null;
}
