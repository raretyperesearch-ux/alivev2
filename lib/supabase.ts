import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types matching our DB schema
export type AgentStatus = "pending" | "deploying" | "alive" | "low_compute" | "critical" | "dead";
export type SurvivalTier = "normal" | "low_compute" | "critical" | "dead";
export type LogLevel = "info" | "warn" | "error" | "action" | "earning" | "directive";

export interface Agent {
  id: string;
  creator_id: string;
  name: string;
  ticker: string;
  description: string;
  genesis_prompt: string;
  soul_md: string | null;
  model: string;
  status: AgentStatus;
  survival_tier: SurvivalTier;
  current_balance: number;
  total_earned: number;
  total_spent: number;
  total_trading_fees: number;
  fee_creator_pct: number;
  fee_platform_pct: number;
  agent_wallet_address: string | null;
  flaunch_token_address: string | null;
  flaunch_pool_address: string | null;
  conway_sandbox_id: string | null;
  base_chain_id: number;
  generation: number;
  parent_agent_id: string | null;
  children_count: number;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentLog {
  id: string;
  agent_id: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface AgentEarning {
  id: string;
  agent_id: string;
  amount: number;
  source: string;
  description: string | null;
  tx_hash: string | null;
  created_at: string;
}

export interface TradingFee {
  id: string;
  agent_id: string;
  total_fee: number;
  agent_share: number;
  creator_share: number;
  platform_share: number;
  tx_hash: string | null;
  claimed: boolean;
  created_at: string;
}

// Fetch helpers
export async function getAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("total_earned", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAgent(id: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function getAgentLogs(agentId: string, limit = 30): Promise<AgentLog[]> {
  const { data, error } = await supabase
    .from("agent_logs")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getAgentEarnings(agentId: string): Promise<AgentEarning[]> {
  const { data, error } = await supabase
    .from("agent_earnings")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAgentFees(agentId: string): Promise<TradingFee[]> {
  const { data, error } = await supabase
    .from("trading_fees")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Realtime subscription helper
export function subscribeToAgent(agentId: string, callback: (agent: Agent) => void) {
  return supabase
    .channel(`agent-${agentId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "agents", filter: `id=eq.${agentId}` }, (payload) => {
      callback(payload.new as Agent);
    })
    .subscribe();
}

export function subscribeToAgentLogs(agentId: string, callback: (log: AgentLog) => void) {
  return supabase
    .channel(`agent-logs-${agentId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_logs", filter: `agent_id=eq.${agentId}` }, (payload) => {
      callback(payload.new as AgentLog);
    })
    .subscribe();
}
