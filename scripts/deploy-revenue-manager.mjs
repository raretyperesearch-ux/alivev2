/**
 * ALiFe — Deploy RevenueManager on Base Mainnet
 * 
 * Run this ONCE to deploy the RevenueManager contract.
 * This sets up the 70/30 fee split for all future agent tokens.
 * 
 * Prerequisites:
 *   - Node.js 18+
 *   - A funded wallet on Base mainnet (needs ~$1-5 in ETH for gas)
 *   - Your private key (NEVER commit this to git)
 * 
 * Usage:
 *   PRIVATE_KEY=0xYOUR_KEY node scripts/deploy-revenue-manager.mjs
 * 
 * After running:
 *   1. Copy the RevenueManager address from the output
 *   2. Add it to Vercel env vars as NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS
 *   3. Add it to .env.local
 *   4. Redeploy
 */

import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createFlaunch } from "@flaunch/sdk";

// ============================================
// CONFIG
// ============================================

const ALIFE_TREASURY = "0xA660a38f40a519F2E351Cc9A5CA2f5feE1a9BE0D";
const PROTOCOL_FEE_PERCENT = 30; // ALiFe takes 30%, creator gets 70%

// ============================================
// MAIN
// ============================================

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("❌ Missing PRIVATE_KEY environment variable");
    console.error("Usage: PRIVATE_KEY=0xYOUR_KEY node scripts/deploy-revenue-manager.mjs");
    process.exit(1);
  }

  console.log("◈ ALiFe — RevenueManager Deployment");
  console.log("════════════════════════════════════");
  console.log(`Network:        Base Mainnet (chainId: 8453)`);
  console.log(`Treasury:       ${ALIFE_TREASURY}`);
  console.log(`Protocol Fee:   ${PROTOCOL_FEE_PERCENT}%`);
  console.log(`Creator Fee:    ${100 - PROTOCOL_FEE_PERCENT}%`);
  console.log("");

  // Create clients
  const account = privateKeyToAccount(privateKey);
  console.log(`Deployer:       ${account.address}`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  const ethBalance = Number(balance) / 1e18;
  console.log(`Balance:        ${ethBalance.toFixed(6)} ETH`);

  if (ethBalance < 0.001) {
    console.error("❌ Insufficient balance. Need at least 0.001 ETH for gas.");
    process.exit(1);
  }

  console.log("");
  console.log("Deploying RevenueManager...");

  // Deploy
  const flaunch = createFlaunch({ publicClient, walletClient });

  const revenueManagerAddress = await flaunch.deployRevenueManager({
    protocolRecipient: ALIFE_TREASURY,
    protocolFeePercent: PROTOCOL_FEE_PERCENT,
  });

  console.log("");
  console.log("════════════════════════════════════");
  console.log("✅ RevenueManager Deployed!");
  console.log(`Address: ${revenueManagerAddress}`);
  console.log("════════════════════════════════════");
  console.log("");
  console.log("Next steps:");
  console.log("1. Add to Vercel env vars:");
  console.log(`   NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS=${revenueManagerAddress}`);
  console.log(`   NEXT_PUBLIC_ALIFE_TREASURY=${ALIFE_TREASURY}`);
  console.log("2. Add to .env.local (same values)");
  console.log("3. Redeploy on Vercel");
  console.log("");
  console.log("Every agent token launched after this will auto-split fees 70/30.");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err.message);
  process.exit(1);
});
