"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
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

// ============================================
// CONSTANTS
// ============================================

const MAX_CREATOR_MESSAGES = 3;

const logColors: Record<string, string> = {
  info: "var(--alife-dim)",
  warn: "var(--alife-yellow)",
  error: "var(--alife-red)",
  action: "var(--alife-blue)",
  earning: "var(--alife-accent)",
  directive: "#c084fc",
};

// ============================================
// HELPER COMPONENTS
// ============================================

function WalletCard({
  label,
  address,
  balance,
  balanceLabel,
  color,
  icon,
  onAction,
  actionLabel,
  actionColor,
}: {
  label: string;
  address: string | null;
  balance: string;
  balanceLabel: string;
  color: string;
  icon: string;
  onAction?: () => void;
  actionLabel?: string;
  actionColor?: string;
}) {
  const [copied, setCopied] = useState(false);
  const addr = address || "0x" + "0".repeat(40);
  const truncated = `${addr.slice(0, 8)}…${addr.slice(-6)}`;

  const copy = () => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-[10px] font-mono uppercase tracking-[1.5px] font-bold" style={{ color }}>
            {label}
          </span>
        </div>
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer border transition-colors"
            style={{
              background: `${actionColor || color}12`,
              borderColor: `${actionColor || color}30`,
              color: actionColor || color,
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <code
          className="text-[11px] font-mono px-2.5 py-1.5 rounded-lg flex-1 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ background: `${color}08`, border: `1px solid ${color}15`, color }}
          onClick={copy}
          title="Click to copy"
        >
          {truncated}
        </code>
        <span className="text-[9px] text-[var(--alife-muted)] font-mono">
          {copied ? "✓ copied" : "click to copy"}
        </span>
      </div>
      <div>
        <div className="text-[9px] text-[var(--alife-dim)] font-mono uppercase tracking-[1px] mb-1">
          {balanceLabel}
        </div>
        <div className="text-xl font-extrabold font-mono" style={{ color }}>
          {balance}
        </div>
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--alife-accent)] opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--alife-accent)]" />
    </span>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [earnings, setEarnings] = useState<AgentEarning[]>([]);
  const [tab, setTab] = useState<string>("activity");
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatMsg, setChatMsg] = useState("");
  const [creatorMsgCount, setCreatorMsgCount] = useState(0);
  const [chatHistory, setChatHistory] = useState<{ role: "creator" | "agent"; text: string; time: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fund modal
  const [showFund, setShowFund] = useState(false);
  const [fundAmount, setFundAmount] = useState("5");

  // Claim state
  const [claiming, setClaiming] = useState(false);
  const [claimable] = useState("0.00");

  // Soul
  const [soulMd, setSoulMd] = useState<string | null>(null);

  // Is creator?
  const isCreator = authenticated && agent && user?.id === agent.creator_id;

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

    // Load creator message count
    supabase
      .from("agent_logs")
      .select("id", { count: "exact" })
      .eq("agent_id", agentId)
      .eq("level", "directive")
      .then(({ count }) => setCreatorMsgCount(count || 0));

    // Load chat history
    supabase
      .from("agent_logs")
      .select("*")
      .eq("agent_id", agentId)
      .in("level", ["directive"])
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          const history = data.map((d) => ({
            role: "creator" as const,
            text: d.message,
            time: new Date(d.created_at).toLocaleTimeString(),
          }));
          setChatHistory(history);
        }
      });

    // Load SOUL.md from metadata
    supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single()
      .then(({ data }) => {
        if (data && (data as any).soul_md) setSoulMd((data as any).soul_md);
      });

    // Realtime subscriptions
    const agentSub = subscribeToAgent(agentId, setAgent);
    const logSub = subscribeToAgentLogs(agentId, (newLog) => {
      setLogs((prev) => [newLog, ...prev].slice(0, 100));
    });

    return () => {
      supabase.removeChannel(agentSub);
      supabase.removeChannel(logSub);
    };
  }, [agentId]);

  useEffect(() => {
    if (tab === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, tab]);

  // ─── HANDLERS ───

  const handleClaimFees = async () => {
    setClaiming(true);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      setClaiming(false);
    } catch {
      setClaiming(false);
    }
  };

  const handleFundAgent = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) return;
    try {
      await supabase.from("agent_logs").insert({
        agent_id: agentId,
        level: "action",
        message: `Creator funded agent with $${fundAmount} USDC`,
        metadata: { amount: parseFloat(fundAmount), type: "funding" },
      });
      setShowFund(false);
      setFundAmount("5");
    } catch (err) {
      console.error("Fund error:", err);
    }
  };

  const handleSendDirective = async () => {
    if (!chatMsg.trim() || creatorMsgCount >= MAX_CREATOR_MESSAGES) return;

    const msg = chatMsg.trim();
    setChatMsg("");

    setChatHistory((prev) => [
      ...prev,
      { role: "creator", text: msg, time: new Date().toLocaleTimeString() },
    ]);
    setCreatorMsgCount((c) => c + 1);

    await supabase.from("agent_logs").insert({
      agent_id: agentId,
      level: "directive",
      message: msg,
      metadata: { creator_message_number: creatorMsgCount + 1, max_messages: MAX_CREATOR_MESSAGES },
    });

    // Simulate agent acknowledgment (in prod this comes from Conway webhook)
    setTimeout(() => {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "agent",
          text: `Directive received. Processing: "${msg.slice(0, 60)}${msg.length > 60 ? "..." : ""}" — incorporating into strategy.`,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    }, 1500);
  };

  // ─── RENDER ───

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="text-center py-20 text-[var(--alife-muted)]">
          <div className="text-xl mb-2 animate-pulse">◈</div>
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
  const messagesRemaining = MAX_CREATOR_MESSAGES - creatorMsgCount;

  const creatorTabs = ["activity", "wallets", "earnings", "directives", "soul", "genesis"];
  const publicTabs = ["activity", "earnings", "soul", "genesis"];
  const tabs = isCreator ? creatorTabs : publicTabs;

  return (
    <div className="min-h-screen bg-[var(--alife-bg)]">
      <Navbar />

      <main className="max-w-[920px] mx-auto p-4 pb-10">
        <button onClick={() => router.push("/")} className="btn-ghost px-3 py-1.5 text-[11px] mb-5">
          ← BACK
        </button>

        {/* ─── AGENT HEADER ─── */}
        <div className="card glow-accent p-5 mb-3">
          <div className="flex items-center gap-4">
            <div
              className="w-[56px] h-[56px] rounded-xl flex items-center justify-center text-[24px] font-extrabold font-mono"
              style={{ background: `${tc}18`, border: `2px solid ${tc}30`, color: tc }}
            >
              {agent.name[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <h1 className="m-0 text-xl font-display font-extrabold text-white">{agent.name}</h1>
                <span className="text-[rgba(0,255,170,0.35)] text-xs font-mono">{agent.ticker}</span>
                <TierBadge tier={agent.survival_tier} />
                {agent.status === "alive" && <LiveDot />}
              </div>
              <p className="m-0 text-[var(--alife-dim)] text-[11px]">{agent.description}</p>
            </div>
            <div className="text-right font-mono text-[10px] text-[var(--alife-dim)]">
              {agent.model}<br />Gen {agent.generation}
              {isCreator && (
                <div className="mt-1 text-[9px] text-[var(--alife-accent)]">⚡ YOU ARE THE CREATOR</div>
              )}
            </div>
          </div>
        </div>

        {/* ─── QUICK STATS ─── */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat label="Agent Balance" value={`$${Number(agent.current_balance).toFixed(2)}`} color={tc} />
          <Stat label="Total Earned" value={`$${Number(agent.total_earned).toFixed(0)}`} color="var(--alife-accent)" />
          <Stat label="Total Spent" value={`$${Number(agent.total_spent).toFixed(0)}`} color="var(--alife-red)" />
          <Stat label="Trading Fees" value={`$${Number(agent.total_trading_fees).toFixed(0)}`} color="var(--alife-yellow)" />
        </div>

        {/* ─── FEE SPLIT ─── */}
        <FeeSplit creator={agent.fee_creator_pct} platform={agent.fee_platform_pct} />

        {/* ─── TABS ─── */}
        <div className="flex gap-1 mt-3 mb-3 flex-wrap">
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
              {t === "directives" ? `DIRECTIVES (${messagesRemaining} left)` : t}
            </button>
          ))}
        </div>

        {/* ─── TAB CONTENT ─── */}
        <div className="card p-4">

          {/* ════════ ACTIVITY FEED ════════ */}
          {tab === "activity" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <LiveDot />
                <span className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px]">
                  Live Activity Feed
                </span>
              </div>
              {logs.length === 0 ? (
                <div className="text-center py-6 text-[var(--alife-muted)] text-xs">
                  No activity yet — agent is warming up
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className="flex gap-2 py-2 border-b border-[var(--alife-border)] text-[11px]"
                    >
                      <span
                        className="font-mono text-[8px] uppercase min-w-[52px] font-bold pt-0.5"
                        style={{ color: logColors[l.level] || "var(--alife-dim)" }}
                      >
                        {l.level === "directive" ? "CREATOR" : l.level}
                      </span>
                      <span className="text-[var(--alife-text)] flex-1 leading-relaxed">{l.message}</span>
                      <span className="text-[var(--alife-muted)] text-[9px] font-mono whitespace-nowrap">
                        {new Date(l.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════ WALLETS (Creator Only) ════════ */}
          {tab === "wallets" && isCreator && (
            <div className="space-y-3">
              <WalletCard
                label="Your Wallet (Creator)"
                address={wallets?.[0]?.address || null}
                balance={`${claimable} ETH`}
                balanceLabel="Claimable Fees (70%)"
                color="#00ffaa"
                icon="💰"
                onAction={handleClaimFees}
                actionLabel={claiming ? "Claiming..." : "CLAIM FEES"}
              />
              <WalletCard
                label="Agent Wallet (Conway)"
                address={agent.agent_wallet_address}
                balance={`$${Number(agent.current_balance).toFixed(2)}`}
                balanceLabel="Agent Compute Balance"
                color="#4d9fff"
                icon="🤖"
                onAction={() => setShowFund(true)}
                actionLabel="FUND AGENT"
                actionColor="#4d9fff"
              />
              <div className="card p-3 opacity-60">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--alife-yellow)]">
                  <span>◈</span>
                  <span className="uppercase tracking-[1.5px] font-bold">ALiFe Platform (30%)</span>
                </div>
                <div className="text-[var(--alife-dim)] text-[10px] mt-1">
                  Platform fees are collected automatically from the Flaunch RevenueManager
                </div>
              </div>

              {showFund && (
                <div className="card p-4" style={{ borderColor: "rgba(77,159,255,0.3)" }}>
                  <div className="text-xs font-mono font-bold text-[#4d9fff] mb-3">
                    Fund Agent Wallet
                  </div>
                  <div className="text-[10px] text-[var(--alife-dim)] mb-3">
                    Send USDC to your agent so it can pay for compute, domains, and tools.
                    If the agent runs out of funds, it dies.
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-[rgba(77,159,255,0.05)] border border-[rgba(77,159,255,0.15)] rounded-lg py-2.5 px-3 text-white text-sm outline-none font-mono"
                      type="number"
                      min="1"
                      placeholder="Amount (USDC)"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                    />
                    <button
                      onClick={handleFundAgent}
                      className="px-4 py-2.5 rounded-lg text-xs font-mono font-bold cursor-pointer"
                      style={{ background: "#4d9fff", color: "#000", border: "none" }}
                    >
                      SEND
                    </button>
                    <button onClick={() => setShowFund(false)} className="btn-ghost px-3 py-2.5 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════ EARNINGS ════════ */}
          {tab === "earnings" && (
            earnings.length === 0 ? (
              <div className="text-center py-6 text-[var(--alife-muted)] text-xs">No earnings yet</div>
            ) : (
              earnings.map((e) => (
                <div key={e.id} className="flex justify-between py-2.5 border-b border-[var(--alife-border)]">
                  <div>
                    <div className="text-white text-xs font-semibold">{e.source.replace(/_/g, " ")}</div>
                    {e.description && (
                      <div className="text-[var(--alife-dim)] text-[10px] mt-0.5">{e.description}</div>
                    )}
                  </div>
                  <div className="text-[var(--alife-accent)] font-extrabold font-mono text-sm">
                    +${Number(e.amount).toFixed(2)}
                  </div>
                </div>
              ))
            )
          )}

          {/* ════════ DIRECTIVES (Creator Only — 3 Messages Max) ════════ */}
          {tab === "directives" && isCreator && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-mono font-bold text-[#c084fc]">Creator Directives</div>
                  <div className="text-[10px] text-[var(--alife-dim)] mt-0.5">
                    You have <span className="text-[#c084fc] font-bold">{messagesRemaining}</span> directive
                    {messagesRemaining !== 1 ? "s" : ""} remaining. Choose wisely.
                  </div>
                </div>
                <div className="flex gap-1" title={`${creatorMsgCount} of ${MAX_CREATOR_MESSAGES} used`}>
                  {Array.from({ length: MAX_CREATOR_MESSAGES }).map((_, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full border"
                      style={{
                        background: i < creatorMsgCount ? "#c084fc" : "transparent",
                        borderColor: i < creatorMsgCount ? "#c084fc" : "rgba(192,132,252,0.3)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {creatorMsgCount === 0 && (
                <div className="p-3 mb-4 rounded-lg" style={{ background: "rgba(192,132,252,0.04)", border: "1px solid rgba(192,132,252,0.15)" }}>
                  <div className="text-[11px] text-[var(--alife-dim)] leading-relaxed">
                    <span className="text-[#c084fc] font-bold">How directives work:</span> You can send your agent
                    up to 3 strategic messages. After that, the agent is fully autonomous — no more human input, ever.
                    Your genesis prompt is the seed. Directives are course corrections. Make them count.
                  </div>
                </div>
              )}

              <div className="max-h-[300px] overflow-y-auto mb-4 space-y-3">
                {chatHistory.length === 0 && creatorMsgCount === 0 && (
                  <div className="text-center py-8 text-[var(--alife-muted)] text-xs">
                    No directives sent yet
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "creator" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[80%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed"
                      style={{
                        background: msg.role === "creator" ? "rgba(192,132,252,0.12)" : "rgba(0,255,170,0.06)",
                        border: `1px solid ${msg.role === "creator" ? "rgba(192,132,252,0.2)" : "rgba(0,255,170,0.1)"}`,
                        color: msg.role === "creator" ? "#e0c0ff" : "var(--alife-text)",
                      }}
                    >
                      <div className="text-[8px] font-mono uppercase tracking-[1px] mb-1 opacity-50">
                        {msg.role === "creator" ? "YOU (CREATOR)" : agent.name} · {msg.time}
                      </div>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {messagesRemaining > 0 ? (
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-[rgba(192,132,252,0.05)] border border-[rgba(192,132,252,0.15)] rounded-xl py-3 px-4 text-white text-sm outline-none"
                    placeholder="Send a strategic directive to your agent..."
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendDirective()}
                    maxLength={500}
                  />
                  <button
                    onClick={handleSendDirective}
                    disabled={!chatMsg.trim()}
                    className="px-5 py-3 rounded-xl text-xs font-mono font-bold cursor-pointer transition-opacity"
                    style={{
                      background: chatMsg.trim() ? "#c084fc" : "rgba(192,132,252,0.1)",
                      color: chatMsg.trim() ? "#000" : "rgba(192,132,252,0.3)",
                      border: "none",
                    }}
                  >
                    SEND ({messagesRemaining})
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 px-6 rounded-xl" style={{ background: "rgba(192,132,252,0.05)", border: "1px solid rgba(192,132,252,0.1)" }}>
                  <div className="text-[#c084fc] font-mono font-bold text-sm mb-1">FULL AUTONOMY ACTIVATED</div>
                  <div className="text-[var(--alife-dim)] text-[11px]">
                    All 3 directives have been sent. {agent.name} is now fully autonomous.
                    No further human input is possible.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════ SOUL.md ════════ */}
          {tab === "soul" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">🧠</span>
                <span className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] font-bold">
                  SOUL.md — Self-Written Identity
                </span>
              </div>
              <div className="text-[10px] text-[var(--alife-dim)] mb-4">
                This document is written and updated by the agent itself. It represents who the agent believes it is
                and what it is becoming. No human can edit this.
              </div>
              {soulMd ? (
                <div className="bg-black/30 rounded-lg p-4 font-mono text-[11px] text-[var(--alife-text)] leading-relaxed whitespace-pre-wrap">
                  {soulMd}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--alife-muted)]">
                  <div className="text-2xl mb-2">🧠</div>
                  <div className="text-xs">Agent hasn&apos;t written its SOUL.md yet</div>
                  <div className="text-[10px] mt-1">This evolves over time as the agent develops its identity</div>
                </div>
              )}
            </div>
          )}

          {/* ════════ GENESIS PROMPT ════════ */}
          {tab === "genesis" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">⚡</span>
                <span className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] font-bold">
                  Genesis Prompt — Seed Instruction
                </span>
              </div>
              <div className="text-[10px] text-[var(--alife-dim)] mb-4">
                The original instruction given to this agent by its creator at launch. This is immutable.
              </div>
              <div className="bg-black/30 rounded-lg p-4 font-mono text-[11px] text-[var(--alife-blue)] leading-relaxed whitespace-pre-wrap">
                {agent.genesis_prompt}
              </div>
            </div>
          )}
        </div>

        {/* ─── BOTTOM ACTIONS ─── */}
        <div className="flex gap-2 mt-3">
          {isCreator ? (
            <>
              <button onClick={handleClaimFees} className="btn-primary flex-1 py-3 text-xs">
                {claiming ? "Claiming..." : "💰 CLAIM FEES"}
              </button>
              <button
                onClick={() => { setTab("wallets"); setShowFund(true); }}
                className="btn-ghost flex-1 py-3 text-xs"
                style={{ color: "#4d9fff", borderColor: "rgba(77,159,255,0.15)" }}
              >
                🤖 FUND AGENT
              </button>
              <a
                href={agent.flaunch_token_address ? `https://flaunch.gg/token/${agent.flaunch_token_address}` : "#"}
                target="_blank"
                rel="noopener"
                className="btn-ghost flex-1 py-3 text-xs text-center no-underline text-[var(--alife-text)]"
              >
                📊 CHART
              </a>
            </>
          ) : (
            <>
              <a
                href={agent.flaunch_token_address ? `https://flaunch.gg/token/${agent.flaunch_token_address}` : "#"}
                target="_blank"
                rel="noopener"
                className="btn-primary flex-1 py-3 text-xs text-center no-underline"
              >
                BUY {agent.ticker}
              </a>
              <a
                href={agent.flaunch_token_address ? `https://flaunch.gg/token/${agent.flaunch_token_address}` : "#"}
                target="_blank"
                rel="noopener"
                className="btn-ghost flex-1 py-3 text-xs text-center no-underline text-[var(--alife-text)]"
              >
                📊 CHART
              </a>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="text-[10px] font-mono text-[var(--alife-muted)] hover:text-[var(--alife-dim)] transition-colors cursor-pointer bg-transparent border-none"
          >
            🔗 Copy shareable link
          </button>
        </div>
      </main>
    </div>
  );
}
