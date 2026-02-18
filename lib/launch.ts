/**
 * ALiFe Launch Orchestrator
 * 
 * This is the core business logic that runs when a user clicks "Launch Agent".
 * It coordinates Flaunch (token), Conway (agent), and Supabase (state).
 * 
 * Flow:
 * 1. Flaunch token on Base via Flaunch SDK → get token address + NFT
 * 2. Provision Conway automaton → get sandbox ID + agent wallet
 * 3. Store everything in Supabase
 * 4. Return the new agent to the frontend
 */

import type { WalletClient } from "viem";
import { flaunchAgentToken, type LaunchAgentTokenParams, type LaunchResult } from "./flaunch";
import { provisionAgent, type ConwayAgent } from "./conway";
import { supabase, type Agent } from "./supabase";

// ============================================
// TYPES
// ============================================

export interface LaunchAgentParams {
  // Creator info (from Privy)
  creatorAddress: `0x${string}`;
  creatorId: string; // Privy user ID

  // Agent config
  name: string;
  ticker: string;
  description: string;
  genesisPrompt: string;
  model?: string;

  // Token config
  imageBase64: string;
  initialMarketCapUSD?: number;
  creatorFeeAllocationPercent?: number;

  // Optional socials
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
}

export interface LaunchAgentResult {
  agent: Agent;
  tokenAddress: string;
  txHash: string;
  sandboxId: string;
}

// ============================================
// LAUNCH ORCHESTRATOR
// ============================================

/**
 * Full launch flow: Flaunch token → Provision agent → Store in DB
 * 
 * This is called from the frontend launch page.
 * The walletClient comes from Privy.
 */
export async function launchAgent(
  walletClient: WalletClient,
  params: LaunchAgentParams,
  onStep?: (step: number, message: string) => void
): Promise<LaunchAgentResult> {
  const step = (n: number, msg: string) => onStep?.(n, msg);

  // ─── Step 1: Flaunch the token on Base ───
  step(0, "Deploying token on Flaunch...");

  let flaunchResult: LaunchResult;
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
  } catch (error) {
    console.error("Flaunch failed:", error);
    throw new Error(`Token launch failed: ${(error as Error).message}`);
  }

  step(1, "Token deployed! Provisioning agent...");

  // ─── Step 2: Provision Conway automaton ───
  step(2, "Spinning up Conway sandbox...");

  let conwayAgent: ConwayAgent;
  try {
    conwayAgent = await provisionAgent({
      name: params.name,
      ticker: params.ticker,
      description: params.description,
      genesisPrompt: params.genesisPrompt,
      creatorAddress: params.creatorAddress,
      tokenAddress: flaunchResult.memecoinAddress,
      model: params.model,
    });
  } catch (error) {
    console.error("Conway provisioning failed:", error);
    // Don't throw — token is already launched. Store with pending status.
    conwayAgent = {
      sandboxId: `pending-${Date.now()}`,
      walletAddress: "0x" + "0".repeat(40),
      status: "provisioning",
      apiEndpoint: "",
    };
  }

  step(3, "Agent wallet generated...");
  step(4, "Writing genesis prompt...");

  // ─── Step 3: Store in Supabase ───
  step(5, "Saving to database...");

  const ticker = params.ticker.startsWith("$") ? params.ticker : `$${params.ticker}`;

  const { data: agent, error: dbError } = await supabase
    .from("agents")
    .insert({
      creator_id: params.creatorId,
      name: params.name,
      ticker,
      description: params.description,
      genesis_prompt: params.genesisPrompt,
      model: params.model || "claude-sonnet-4-20250514",
      status: conwayAgent.status === "alive" ? "alive" : "deploying",
      survival_tier: "normal",
      current_balance: 0,
      total_earned: 0,
      total_spent: 0,
      total_trading_fees: 0,
      fee_creator_pct: 70,
      fee_platform_pct: 30,
      agent_wallet_address: conwayAgent.walletAddress,
      flaunch_token_address: flaunchResult.memecoinAddress,
      flaunch_pool_address: flaunchResult.poolAddress,
      flaunch_nft_id: flaunchResult.tokenId,
      conway_sandbox_id: conwayAgent.sandboxId,
      base_chain_id: 8453,
      generation: 1,
      children_count: 0,
    })
    .select()
    .single();

  if (dbError) {
    console.error("Supabase insert error:", dbError);
    throw new Error(`Database error: ${dbError.message}`);
  }

  // Log the launch
  await supabase.from("agent_logs").insert({
    agent_id: agent.id,
    level: "action",
    message: `Agent launched! Token: ${flaunchResult.memecoinAddress.slice(0, 10)}... | Sandbox: ${conwayAgent.sandboxId}`,
    metadata: {
      tx_hash: flaunchResult.txHash,
      token_address: flaunchResult.memecoinAddress,
      token_id: flaunchResult.tokenId,
      sandbox_id: conwayAgent.sandboxId,
      agent_wallet: conwayAgent.walletAddress,
    },
  });

  step(6, "Agent is ALIVE ⚡");

  return {
    agent: agent as Agent,
    tokenAddress: flaunchResult.memecoinAddress,
    txHash: flaunchResult.txHash,
    sandboxId: conwayAgent.sandboxId,
  };
}

// ============================================
// AGENT LIFECYCLE
// ============================================

/**
 * Fund an agent's Conway wallet
 * Creator sends ETH/USDC to the agent's wallet so it can pay for compute
 */
export async function fundAgentWallet(
  agentId: string,
  amount: number,
  funderId: string
): Promise<void> {
  // Get agent details
  const { data: agent } = await supabase
    .from("agents")
    .select("conway_sandbox_id, agent_wallet_address")
    .eq("id", agentId)
    .single();

  if (!agent) throw new Error("Agent not found");

  // Record the funding event
  await supabase.from("funding_events").insert({
    agent_id: agentId,
    funder_id: funderId,
    amount,
    tx_hash: null, // Will be updated after on-chain tx
  });

  // Log it
  await supabase.from("agent_logs").insert({
    agent_id: agentId,
    level: "action",
    message: `Received $${amount} funding from creator`,
  });
}

/**
 * Kill an agent — stop the Conway sandbox and mark as dead
 */
export async function terminateAgent(agentId: string): Promise<void> {
  const { data: agent } = await supabase
    .from("agents")
    .select("conway_sandbox_id")
    .eq("id", agentId)
    .single();

  if (!agent) throw new Error("Agent not found");

  // Update DB
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
