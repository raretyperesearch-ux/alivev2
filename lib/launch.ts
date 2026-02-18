// @ts-nocheck
/**
 * Alive Agents v2 Launch Orchestrator
 * 
 * Core business logic for "Launch Agent" button.
 * Coordinates: Flaunch (token) → Supabase (state) → Conway (agent)
 * 
 * Flaunch token deployment is REQUIRED — if it fails, the launch fails.
 * The user MUST sign the on-chain transaction via their Privy wallet.
 * 
 * Fee model:
 * - Platform wallet receives Flaunch NFT + all trading fees
 * - Creator's wallet stored in DB for payout tracking
 * - Creator gets 70%, platform keeps 30%
 */

import { flaunchAgentToken, getRevenueManagerAddress } from "./flaunch";
import { provisionAgent } from "./conway";
import { supabase } from "./supabase";

// ============================================
// TYPES
// ============================================

export interface LaunchAgentParams {
  creatorAddress: string;
  creatorId: string;
  name: string;
  ticker: string;
  description: string;
  genesisPrompt: string;
  model?: string;
  imageBase64: string;
  initialMarketCapUSD?: number;
  creatorFeeAllocationPercent?: number;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
}

export interface LaunchAgentResult {
  agent: any;
  tokenAddress: string | null;
  txHash: string | null;
  sandboxId: string;
}

// ============================================
// LAUNCH ORCHESTRATOR
// ============================================

export async function launchAgent(
  walletClient,
  params: LaunchAgentParams,
  onStep?: (step: number, message: string) => void
): Promise<LaunchAgentResult> {
  const step = (n: number, msg: string) => {
    console.log(`[launch] Step ${n}: ${msg}`);
    onStep?.(n, msg);
  };

  // --- Step 0: Verify config ---
  const treasuryCheck = getRevenueManagerAddress();
  if (!treasuryCheck) {
    throw new Error("Platform treasury not configured.");
  }

  // --- Step 1: Deploy token on Flaunch ---
  step(0, "Deploying token on Flaunch…");

  let flaunchResult;
  try {
    flaunchResult = await flaunchAgentToken(walletClient, {
      name: params.name,
      symbol: params.ticker.replace("$", ""),
      description: params.description,
      imageBase64: params.imageBase64,
      creatorAddress: params.creatorAddress,
      initialMarketCapUSD: params.initialMarketCapUSD,
      creatorFeeAllocationPercent: params.creatorFeeAllocationPercent,
      websiteUrl: params.websiteUrl,
      twitterUrl: params.twitterUrl,
      telegramUrl: params.telegramUrl,
    });
    console.log("[launch] Flaunch result:", flaunchResult);
  } catch (error) {
    console.error("[launch] Flaunch FAILED:", error);
    if (error.message?.includes("User rejected") || error.message?.includes("denied")) {
      throw new Error("Transaction rejected — you need to sign the Flaunch transaction to deploy your token.");
    }
    throw new Error(`Token deployment failed: ${error.message}`);
  }

  step(1, "Token deployed on Base!");

  // --- Step 2: Save to Supabase ---
  step(2, "Creating agent record…");

  const ticker = params.ticker.startsWith("$") ? params.ticker : `$${params.ticker}`;

  const { data: agent, error: dbError } = await supabase
    .from("agents")
    .insert({
      creator_id: params.creatorId,
      creator_wallet_address: params.creatorAddress,  // Track who to pay
      name: params.name,
      ticker,
      description: params.description,
      genesis_prompt: params.genesisPrompt,
      model: params.model || "claude-sonnet-4-20250514",
      status: "deploying",
      survival_tier: "normal",
      current_balance: 0,
      total_earned: 0,
      total_spent: 0,
      total_trading_fees: 0,
      fee_creator_pct: 70,
      fee_platform_pct: 30,
      creator_fees_owed: 0,
      creator_fees_paid: 0,
      agent_wallet_address: "pending",
      flaunch_token_address: flaunchResult.memecoinAddress || null,
      flaunch_pool_address: flaunchResult.poolAddress || null,
      flaunch_nft_id: flaunchResult.tokenId != null ? flaunchResult.tokenId : null,
      flaunch_tx_hash: flaunchResult.txHash,
      split_manager_address: null,
      conway_sandbox_id: "pending",
      base_chain_id: 8453,
      generation: 1,
      children_count: 0,
    })
    .select()
    .single();

  if (dbError) {
    console.error("[launch] Supabase insert error:", dbError);
    throw new Error(`Database error: ${dbError.message}`);
  }

  // --- Step 3: Provision Conway agent ---
  step(3, "Spinning up Conway sandbox…");

  let conwayAgent;
  try {
    conwayAgent = await provisionAgent({
      name: params.name,
      ticker: params.ticker,
      description: params.description,
      genesisPrompt: params.genesisPrompt,
      creatorAddress: params.creatorAddress,
      tokenAddress: flaunchResult.memecoinAddress,
      model: params.model,
      agentId: agent.id,
    });

    step(4, "Agent wallet generated…");

    await supabase.from("agents").update({
      conway_sandbox_id: conwayAgent.sandboxId,
      agent_wallet_address: conwayAgent.walletAddress,
      status: "alive",
    }).eq("id", agent.id);

  } catch (error) {
    console.error("[launch] Conway provisioning failed:", error);
    conwayAgent = {
      sandboxId: `pending-${Date.now()}`,
      walletAddress: "pending",
      status: "provisioning",
      apiEndpoint: "",
    };
    await supabase.from("agents").update({
      conway_sandbox_id: conwayAgent.sandboxId,
      status: "deploying",
    }).eq("id", agent.id);
    step(4, "Conway provisioning queued…");
  }

  step(5, "Writing genesis prompt…");

  await supabase.from("agent_logs").insert({
    agent_id: agent.id,
    level: "action",
    message: `Agent launched! Token: ${flaunchResult.memecoinAddress ? flaunchResult.memecoinAddress.slice(0, 10) + "…" : "parsing..."} | Sandbox: ${conwayAgent.sandboxId}`,
    metadata: {
      tx_hash: flaunchResult.txHash,
      token_address: flaunchResult.memecoinAddress,
      sandbox_id: conwayAgent.sandboxId,
      agent_wallet: conwayAgent.walletAddress,
      creator_wallet: params.creatorAddress,
    },
  });

  step(6, "Agent is ALIVE ⚡");

  return {
    agent,
    tokenAddress: flaunchResult.memecoinAddress,
    txHash: flaunchResult.txHash,
    sandboxId: conwayAgent.sandboxId,
  };
}

// ============================================
// AGENT LIFECYCLE
// ============================================

export async function fundAgentWallet(agentId, amount, funderId) {
  const { data: agent } = await supabase
    .from("agents")
    .select("conway_sandbox_id, agent_wallet_address")
    .eq("id", agentId)
    .single();

  if (!agent) throw new Error("Agent not found");

  await supabase.from("funding_events").insert({
    agent_id: agentId,
    funder_id: funderId,
    amount,
    tx_hash: null,
  });

  await supabase.from("agent_logs").insert({
    agent_id: agentId,
    level: "action",
    message: `Received $${amount} funding from creator`,
  });
}

export async function terminateAgent(agentId) {
  await supabase.from("agents").update({
    status: "dead",
    survival_tier: "dead",
  }).eq("id", agentId);

  await supabase.from("agent_logs").insert({
    agent_id: agentId,
    level: "error",
    message: "Agent terminated by creator",
  });
}
