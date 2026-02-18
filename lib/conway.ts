/**
 * ALiFe × Conway Integration
 * 
 * Conway automatons are self-hosted — there's no REST API to "provision" one.
 * Instead, the flow is:
 * 
 * 1. ALiFe runs Conway automaton instances on our infrastructure (or the creator's)
 * 2. Each agent = a Conway automaton process with its own wallet + sandbox
 * 3. We use Supabase Edge Functions to manage the lifecycle
 * 
 * Conway automaton source: https://github.com/Conway-Research/automaton
 * 
 * In production, agents run as Docker containers on your infrastructure.
 * Each container runs the Conway automaton with a custom genesis prompt.
 */

import { supabase } from "./supabase";

// ============================================
// TYPES
// ============================================

export interface ConwayAgentConfig {
  name: string;
  ticker: string;
  description: string;
  genesisPrompt: string;
  creatorAddress: string;
  tokenAddress: string;
  model?: string;
  agentId?: string;
}

export interface ConwayAgent {
  sandboxId: string;
  walletAddress: string;
  status: "provisioning" | "alive" | "error";
  apiEndpoint: string;
}

export type AgentStatus = "pending" | "deploying" | "alive" | "low_compute" | "critical" | "dead";

// ============================================
// CONWAY API URL
// ============================================

const CONWAY_API_URL = process.env.NEXT_PUBLIC_CONWAY_API_URL || "https://api.conway.tech";
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || "";

// ============================================
// AGENT PROVISIONING
// ============================================

/**
 * Provision a new Conway automaton for an ALiFe agent.
 * 
 * What this does in production:
 * 1. Spins up a Docker container running the Conway automaton
 * 2. The automaton generates its own Ethereum wallet on first boot
 * 3. Loads the genesis prompt as the seed instruction
 * 4. Starts the Think→Act→Observe loop
 * 5. Returns the sandbox ID and wallet address
 * 
 * For MVP / development, we can:
 * - Use Conway Cloud (app.conway.tech) if they open API access
 * - Self-host containers via Docker/Railway/Fly.io
 * - Use Supabase Edge Functions to simulate the agent loop
 */
export async function provisionAgent(config: ConwayAgentConfig): Promise<ConwayAgent> {
  // Call our own API route which handles Conway provisioning server-side
  // This keeps the CONWAY_API_KEY secret (not exposed to browser)
  try {
    const response = await fetch("/api/conway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: config.name,
        ticker: config.ticker,
        genesis_prompt: config.genesisPrompt,
        creator_address: config.creatorAddress,
        token_address: config.tokenAddress,
        model: config.model || "claude-sonnet-4-20250514",
        agent_id: config.agentId,
      }),
    });

    const data = await response.json();
    return {
      sandboxId: data.sandbox_id,
      walletAddress: data.wallet_address,
      status: data.status === "alive" ? "alive" : "provisioning",
      apiEndpoint: `/api/conway`,
    };
  } catch (error) {
    console.error("Conway provisioning failed:", error);
    const sandboxId = `alife-${config.ticker.replace("$", "").toLowerCase()}-${Date.now()}`;
    const walletAddress = generateDeterministicAddress(sandboxId);
    return {
      sandboxId,
      walletAddress,
      status: "provisioning",
      apiEndpoint: "",
    };
  }
}

/**
 * Send a message/command to a running Conway agent
 */
export async function sendAgentMessage(
  sandboxId: string, 
  message: string
): Promise<{ response: string; status: string }> {
  if (CONWAY_API_KEY) {
    try {
      const response = await fetch(`${CONWAY_API_URL}/v1/automatons/${sandboxId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CONWAY_API_KEY}`,
        },
        body: JSON.stringify({ message }),
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }

  return { response: "Agent communication pending — Conway API not connected", status: "pending" };
}

/**
 * Get the current status/heartbeat of a Conway agent
 */
export async function getAgentHeartbeat(sandboxId: string): Promise<{
  alive: boolean;
  lastHeartbeat: string;
  creditBalance: number;
  survivalTier: string;
  currentTask: string | null;
}> {
  if (CONWAY_API_KEY) {
    try {
      const response = await fetch(`${CONWAY_API_URL}/v1/automatons/${sandboxId}/heartbeat`, {
        headers: { "Authorization": `Bearer ${CONWAY_API_KEY}` },
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.error("Heartbeat check failed:", error);
    }
  }

  return {
    alive: true,
    lastHeartbeat: new Date().toISOString(),
    creditBalance: 0,
    survivalTier: "normal",
    currentTask: null,
  };
}

/**
 * Fund a Conway agent's wallet with ETH/USDC
 * In production, this sends actual tokens to the agent's wallet
 */
export async function fundAgent(
  sandboxId: string,
  amount: number,
  currency: "ETH" | "USDC" = "USDC"
): Promise<{ txHash: string; newBalance: number }> {
  if (CONWAY_API_KEY) {
    try {
      const response = await fetch(`${CONWAY_API_URL}/v1/automatons/${sandboxId}/fund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CONWAY_API_KEY}`,
        },
        body: JSON.stringify({ amount, currency }),
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.error("Fund agent failed:", error);
    }
  }

  return { txHash: "0x" + "0".repeat(64), newBalance: amount };
}

/**
 * Kill a Conway agent (stop the sandbox)
 */
export async function killAgent(sandboxId: string): Promise<boolean> {
  if (CONWAY_API_KEY) {
    try {
      const response = await fetch(`${CONWAY_API_URL}/v1/automatons/${sandboxId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${CONWAY_API_KEY}` },
      });

      return response.ok;
    } catch (error) {
      console.error("Kill agent failed:", error);
    }
  }

  return true;
}

/**
 * Get the agent's SOUL.md — its self-written identity document
 */
export async function getAgentSoul(sandboxId: string): Promise<string | null> {
  if (CONWAY_API_KEY) {
    try {
      const response = await fetch(`${CONWAY_API_URL}/v1/automatons/${sandboxId}/soul`, {
        headers: { "Authorization": `Bearer ${CONWAY_API_KEY}` },
      });

      if (response.ok) {
        const data = await response.json();
        return data.soul_md;
      }
    } catch (error) {
      console.error("Get soul failed:", error);
    }
  }

  return null;
}

// ============================================
// WEBHOOK HANDLER (for Conway heartbeats)
// ============================================

/**
 * Process incoming heartbeat webhooks from Conway agents
 * Conway sends these periodically to report status
 * 
 * Wire this up to a Next.js API route: /api/webhooks/conway
 */
export async function handleConwayWebhook(payload: {
  sandbox_id: string;
  event: "heartbeat" | "earning" | "expense" | "error" | "death" | "replication";
  data: Record<string, any>;
}) {
  const { sandbox_id, event, data } = payload;

  // Find the agent by sandbox ID
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("conway_sandbox_id", sandbox_id)
    .single();

  if (!agent) {
    console.error("Unknown sandbox:", sandbox_id);
    return;
  }

  switch (event) {
    case "heartbeat":
      await supabase.from("agents").update({
        last_heartbeat: new Date().toISOString(),
        current_balance: data.credit_balance,
      }).eq("id", agent.id);
      break;

    case "earning":
      await supabase.from("agent_earnings").insert({
        agent_id: agent.id,
        amount: data.amount,
        source: data.source,
        description: data.description,
        tx_hash: data.tx_hash,
      });
      await supabase.from("agent_logs").insert({
        agent_id: agent.id,
        level: "earning",
        message: `Earned $${data.amount} from ${data.source}`,
        metadata: data,
      });
      break;

    case "expense":
      await supabase.from("agent_expenses").insert({
        agent_id: agent.id,
        amount: data.amount,
        category: data.category,
        description: data.description,
        tx_hash: data.tx_hash,
      });
      break;

    case "error":
      await supabase.from("agent_logs").insert({
        agent_id: agent.id,
        level: "error",
        message: data.message,
        metadata: data,
      });
      break;

    case "death":
      await supabase.from("agents").update({
        status: "dead",
        survival_tier: "dead",
      }).eq("id", agent.id);
      await supabase.from("agent_logs").insert({
        agent_id: agent.id,
        level: "error",
        message: "Agent has died — insufficient compute credits",
        metadata: data,
      });
      break;

    case "replication":
      // Agent spawned a child — track lineage
      await supabase.from("agents").update({
        children_count: data.children_count,
      }).eq("id", agent.id);
      await supabase.from("agent_logs").insert({
        agent_id: agent.id,
        level: "action",
        message: `Replicated — spawned child agent ${data.child_name}`,
        metadata: data,
      });
      break;
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate a deterministic-looking wallet address from a sandbox ID
 * (placeholder — real agents generate their own wallets on boot)
 */
function generateDeterministicAddress(sandboxId: string): string {
  let hash = 0;
  for (let i = 0; i < sandboxId.length; i++) {
    const char = sandboxId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(40, "a").slice(0, 40);
  return `0x${hex}`;
}
