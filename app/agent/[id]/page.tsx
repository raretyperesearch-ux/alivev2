"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Stat from "@/components/Stat";
import TierBadge, { tierColor } from "@/components/TierBadge";
import FeeSplit from "@/components/FeeSplit";
import {
  getAgent,
  getAgentLogs,
  getAgentEarnings,
  subscribeToAgent,
  subscribeToAgentLogs,
  supabase,
  Agent,
  AgentLog,
  AgentEarning,
} from "@/lib/supabase";

const logColors: Record<string, string> = {
  info: "var(--alife-dim)",
  warn: "var(--alife-yellow)",
  error: "var(--alife-red)",
  action: "var(--alife-blue)",
  earning: "var(--alife-accent)",
};

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [earnings, setEarnings] = useState<AgentEarning[]>([]);
  const [tab, setTab] = useState<"logs" | "earnings" | "info" | "genesis">("logs");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentId) return;

    Promise.all([
      getAgent(agentId),
      getAgentLogs(agentId),
      getAgentEarnings(agentId),
    ]).then(([a, l, e]) => {
      setAgent(a);
      setLogs(l);
      setEarnings(e);
      setLoading(false);
    });

    // Realtime subscriptions
    const agentSub = subscribeToAgent(agentId, setAgent);
    const logSub = subscribeToAgentLogs(agentId, (newLog) => {
      setLogs((prev) => [newLog, ...prev].slice(0, 50));
    });

    return () => {
      supabase.removeChannel(agentSub);
      supabase.removeChannel(logSub);
    };
  }, [agentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="text-center py-20 text-[var(--alife-muted)]">
          <div className="text-xl mb-2">◈</div>
          <span className="font-mono text-xs">Loading agent…</span>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="text-center py-20">
          <div className="text-3xl mb-4">◈</div>
          <p className="text-[var(--alife-dim)]">Agent not found</p>
          <button onClick={() => router.push("/")} className="btn-ghost px-4 py-2 text-xs mt-4">
            ← HOME
          </button>
        </div>
      </div>
    );
  }

  const tc = tierColor(agent.survival_tier);
  const truncate = (addr: string | null) =>
    addr ? `${addr.slice(0, 10)}…${addr.slice(-6)}` : "—";

  const tabs = ["logs", "earnings", "info", "genesis"] as const;

  return (
    <div className="min-h-screen bg-[var(--alife-bg)]">
      <Navbar />

      <main className="max-w-[920px] mx-auto p-4 pb-10">
        {/* Back */}
        <button
          onClick={() => router.push("/")}
          className="btn-ghost px-3 py-1.5 text-[11px] mb-5"
        >
          ← BACK
        </button>

        {/* Agent Header */}
        <div className="card glow-accent p-5 mb-3">
          <div className="flex items-center gap-4">
            <div
              className="w-[52px] h-[52px] rounded-xl flex items-center justify-center text-[22px] font-extrabold font-mono"
              style={{
                background: `${tc}18`,
                border: `2px solid ${tc}30`,
                color: tc,
              }}
            >
              {agent.name[0]}
            </div>

            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <h1 className="m-0 text-xl font-display font-extrabold text-white">
                  {agent.name}
                </h1>
                <span className="text-[rgba(0,255,170,0.35)] text-xs font-mono">
                  {agent.ticker}
                </span>
                <TierBadge tier={agent.survival_tier} />
              </div>
              <p className="m-0 text-[var(--alife-dim)] text-[11px]">
                {agent.description}
              </p>
            </div>

            <div className="text-right font-mono text-[10px] text-[var(--alife-dim)]">
              {agent.model}
              <br />
              Gen {agent.generation}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat label="Balance" value={`$${Number(agent.current_balance).toFixed(2)}`} color={tc} />
          <Stat label="Earned" value={`$${Number(agent.total_earned).toFixed(0)}`} color="var(--alife-accent)" />
          <Stat label="Spent" value={`$${Number(agent.total_spent).toFixed(0)}`} color="var(--alife-red)" />
          <Stat label="Fees" value={`$${Number(agent.total_trading_fees).toFixed(0)}`} color="var(--alife-yellow)" />
        </div>

        {/* Fee Split */}
        <FeeSplit
          creator={agent.fee_creator_pct}
          platform={agent.fee_platform_pct}
        />

        {/* Tabs */}
        <div className="flex gap-1 mt-3 mb-3">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-[1px] cursor-pointer border transition-colors ${
                tab === t
                  ? "bg-[rgba(0,255,170,0.08)] border-[rgba(0,255,170,0.25)] text-[var(--alife-accent)]"
                  : "bg-transparent border-[var(--alife-border)] text-[var(--alife-dim)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="card p-4">
          {tab === "logs" &&
            (logs.length === 0 ? (
              <div className="text-center py-6 text-[var(--alife-muted)] text-xs">
                No logs yet — agent is warming up
              </div>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className="flex gap-2 py-1.5 border-b border-[var(--alife-border)] text-[11px] animate-fade-in"
                >
                  <span
                    className="font-mono text-[8px] uppercase min-w-[44px] font-bold pt-0.5"
                    style={{ color: logColors[l.level] || "var(--alife-dim)" }}
                  >
                    {l.level}
                  </span>
                  <span className="text-[var(--alife-text)] flex-1 leading-relaxed">
                    {l.message}
                  </span>
                  <span className="text-[var(--alife-muted)] text-[9px] font-mono whitespace-nowrap">
                    {new Date(l.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ))}

          {tab === "earnings" &&
            (earnings.length === 0 ? (
              <div className="text-center py-6 text-[var(--alife-muted)] text-xs">
                No earnings yet
              </div>
            ) : (
              earnings.map((e) => (
                <div
                  key={e.id}
                  className="flex justify-between py-2.5 border-b border-[var(--alife-border)]"
                >
                  <div>
                    <div className="text-white text-xs font-semibold">
                      {e.source.replace(/_/g, " ")}
                    </div>
                    {e.description && (
                      <div className="text-[var(--alife-dim)] text-[10px] mt-0.5">
                        {e.description}
                      </div>
                    )}
                  </div>
                  <div className="text-[var(--alife-accent)] font-extrabold font-mono text-sm">
                    +${Number(e.amount).toFixed(2)}
                  </div>
                </div>
              ))
            ))}

          {tab === "info" && (
            <>
              {[
                ["Agent Wallet", truncate(agent.agent_wallet_address)],
                ["Token", truncate(agent.flaunch_token_address)],
                ["Pool", truncate(agent.flaunch_pool_address)],
                ["Conway Sandbox", agent.conway_sandbox_id || "—"],
                ["Chain", `Base (${agent.base_chain_id})`],
                ["Generation", `Gen ${agent.generation}`],
                ["Children", String(agent.children_count)],
                [
                  "Last Heartbeat",
                  agent.last_heartbeat
                    ? new Date(agent.last_heartbeat).toLocaleString()
                    : "—",
                ],
              ].map(([k, v], i) => (
                <div
                  key={i}
                  className="flex justify-between py-2 border-b border-[var(--alife-border)] text-[11px]"
                >
                  <span className="text-[var(--alife-dim)]">{k}</span>
                  <span className="text-[var(--alife-text)] font-mono text-[10px]">{v}</span>
                </div>
              ))}
            </>
          )}

          {tab === "genesis" && (
            <div className="bg-black/30 rounded-lg p-4 font-mono text-[11px] text-[var(--alife-blue)] leading-relaxed whitespace-pre-wrap">
              {agent.genesis_prompt}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button className="btn-primary flex-1 py-3 text-xs">💰 FUND</button>
          <button className="btn-ghost flex-1 py-3 text-xs text-[var(--alife-text)]">
            📊 CHART
          </button>
          <button className="btn-ghost flex-1 py-3 text-xs text-[var(--alife-red)] border-[rgba(255,51,85,0.15)] hover:border-[rgba(255,51,85,0.3)]">
            KILL
          </button>
        </div>
      </main>
    </div>
  );
}
