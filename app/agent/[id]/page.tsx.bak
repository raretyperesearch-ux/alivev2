"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Navbar from "@/components/Navbar";
import TierBadge, { tierColor } from "@/components/TierBadge";
import { getCreatorClaimableBalance, claimCreatorFees, getPlatformClaimableBalance, claimPlatformFees } from "@/lib/flaunch";
import { createWalletClient, custom, formatEther } from "viem";
import { base } from "viem/chains";
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
  info: "rgba(255,255,255,0.45)",
  warn: "#ffd866",
  error: "#ff5555",
  action: "#00ffaa",
  earning: "#00ffaa",
  directive: "#c084fc",
};

const logIcons: Record<string, string> = {
  info: "›",
  warn: "⚠",
  error: "✕",
  action: "▸",
  earning: "$",
  directive: "⌘",
};

// ============================================
// HELPER COMPONENTS
// ============================================

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--alife-accent)] opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--alife-accent)]" />
    </span>
  );
}

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

  const [chatMsg, setChatMsg] = useState("");
  const [creatorMsgCount, setCreatorMsgCount] = useState(0);
  const [chatHistory, setChatHistory] = useState<{ role: "creator" | "agent"; text: string; time: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [showFund, setShowFund] = useState(false);
  const [fundAmount, setFundAmount] = useState("5");
  const [claiming, setClaiming] = useState(false);
  const [claimable, setClaimable] = useState("0.00");
  const [claimError, setClaimError] = useState("");
  const [soulMd, setSoulMd] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

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

    supabase
      .from("agent_logs")
      .select("id", { count: "exact" })
      .eq("agent_id", agentId)
      .eq("level", "directive")
      .then(({ count }) => setCreatorMsgCount(count || 0));

    supabase
      .from("agent_logs")
      .select("*")
      .eq("agent_id", agentId)
      .in("level", ["directive"])
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setChatHistory(data.map((d) => ({
            role: "creator" as const,
            text: d.message,
            time: new Date(d.created_at).toLocaleTimeString(),
          })));
        }
      });

    supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single()
      .then(({ data }) => {
        if (data && (data as any).soul_md) setSoulMd((data as any).soul_md);
      });

    // Fetch claimable fees from SplitManager
    if (wallets?.[0]?.address && agent?.split_manager_address) {
      getCreatorClaimableBalance(wallets[0].address as `0x${string}`, agent.split_manager_address as `0x${string}`)
        .then((balance) => {
          setClaimable(parseFloat(formatEther(balance)).toFixed(6));
        })
        .catch((err) => console.warn("Failed to fetch claimable:", err));
    }

    const agentSub = subscribeToAgent(agentId, setAgent);
    const logSub = subscribeToAgentLogs(agentId, (newLog) => {
      setLogs((prev) => [newLog, ...prev].slice(0, 100));
    });

    return () => {
      supabase.removeChannel(agentSub);
      supabase.removeChannel(logSub);
    };
  }, [agentId, wallets]);

  useEffect(() => {
    if (tab === "directives") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, tab]);

  const handleClaimFees = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimError("");
    try {
      const wallet = wallets?.[0];
      if (!wallet) throw new Error("No wallet connected");

      await wallet.switchChain(base.id);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: base,
        transport: custom(provider),
      });

      const txHash = await claimCreatorFees(walletClient, agent?.split_manager_address as `0x${string}`);
      console.log("Claim tx:", txHash);

      // Refresh balance
      const newBalance = await getCreatorClaimableBalance(wallet.address as `0x${string}`, agent?.split_manager_address as `0x${string}`);
      setClaimable(parseFloat(formatEther(newBalance)).toFixed(6));

      // Log it
      await supabase.from("agent_logs").insert({
        agent_id: agentId,
        level: "earning",
        message: `Creator claimed fees — tx: ${txHash.slice(0, 10)}…`,
        metadata: { tx_hash: txHash },
      });
    } catch (err: any) {
      console.error("Claim error:", err);
      setClaimError(err.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const handleFundAgent = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) return;
    try {
      await supabase.from("agent_logs").insert({
        agent_id: agentId, level: "action",
        message: `Creator funded agent with $${fundAmount} USDC`,
        metadata: { amount: parseFloat(fundAmount), type: "funding" },
      });
      setShowFund(false);
      setFundAmount("5");
    } catch (err) { console.error("Fund error:", err); }
  };

  const handleSendDirective = async () => {
    if (!chatMsg.trim() || creatorMsgCount >= MAX_CREATOR_MESSAGES) return;
    const msg = chatMsg.trim();
    setChatMsg("");
    setChatHistory((prev) => [...prev, { role: "creator", text: msg, time: new Date().toLocaleTimeString() }]);
    setCreatorMsgCount((c) => c + 1);
    await supabase.from("agent_logs").insert({
      agent_id: agentId, level: "directive", message: msg,
      metadata: { creator_message_number: creatorMsgCount + 1, max_messages: MAX_CREATOR_MESSAGES },
    });
    setTimeout(() => {
      setChatHistory((prev) => [...prev, {
        role: "agent",
        text: `Directive received. Processing: "${msg.slice(0, 60)}${msg.length > 60 ? "..." : ""}" — incorporating into strategy.`,
        time: new Date().toLocaleTimeString(),
      }]);
    }, 1500);
  };

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
          <button onClick={() => router.push("/")} className="btn-ghost px-4 py-2 text-xs mt-4">← HOME</button>
        </div>
      </div>
    );
  }

  const tc = tierColor(agent.survival_tier);
  const messagesRemaining = MAX_CREATOR_MESSAGES - creatorMsgCount;
  const creatorTabs = ["activity", "wallets", "earnings", "directives", "soul", "genesis"];
  const publicTabs = ["activity", "earnings", "soul", "genesis"];
  const tabList = isCreator ? creatorTabs : publicTabs;

  return (
    <div className="min-h-screen bg-[var(--alife-bg)]">
      <Navbar />

      <main className="max-w-[1100px] mx-auto p-4 pb-10">
        <button onClick={() => router.push("/")} className="btn-ghost px-3 py-1.5 text-[11px] mb-4">← BACK</button>

        {/* ─── COMPACT AGENT HEADER + INLINE STATS ─── */}
        <div className="card glow-accent p-4 mb-3">
          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            <div
              className="w-[48px] h-[48px] rounded-xl flex items-center justify-center text-[20px] font-extrabold font-mono shrink-0"
              style={{ background: `${tc}18`, border: `2px solid ${tc}30`, color: tc }}
            >
              {agent.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <h1 className="m-0 text-lg font-display font-extrabold text-white truncate">{agent.name}</h1>
                <span className="text-[rgba(0,255,170,0.35)] text-xs font-mono">{agent.ticker}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <TierBadge tier={agent.survival_tier} />
                {agent.status === "alive" && <LiveDot />}
              </div>
              <p className="m-0 text-[var(--alife-dim)] text-[11px] truncate mt-1">{agent.description}</p>
            </div>
          </div>
          {/* Stats row — always below on mobile */}
          <div className="flex gap-4 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid var(--alife-border)" }}>
            <div className="text-center min-w-[60px]">
              <div className="text-[8px] font-mono uppercase tracking-[1px] text-[var(--alife-dim)]">Balance</div>
              <div className="text-sm font-extrabold font-mono" style={{ color: tc }}>${Number(agent.current_balance).toFixed(2)}</div>
            </div>
            <div className="text-center min-w-[60px]">
              <div className="text-[8px] font-mono uppercase tracking-[1px] text-[var(--alife-dim)]">Earned</div>
              <div className="text-sm font-extrabold font-mono text-[var(--alife-accent)]">${Number(agent.total_earned).toFixed(0)}</div>
            </div>
            <div className="text-center min-w-[60px]">
              <div className="text-[8px] font-mono uppercase tracking-[1px] text-[var(--alife-dim)]">Model</div>
              <div className="text-[10px] font-mono text-[var(--alife-dim)]">{agent.model?.replace("claude-", "").replace("-20250514", "")}</div>
            </div>
            <div className="text-center min-w-[40px]">
              <div className="text-[8px] font-mono uppercase tracking-[1px] text-[var(--alife-dim)]">Gen</div>
              <div className="text-[10px] font-mono text-[var(--alife-dim)]">{agent.generation}</div>
            </div>
            {isCreator && (
              <div className="flex items-center ml-auto">
                <span className="text-[9px] font-mono text-[var(--alife-accent)]">⚡ CREATOR</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── TABS ─── */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {tabList.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-[1px] cursor-pointer border transition-colors whitespace-nowrap shrink-0 ${
                tab === t
                  ? "bg-[rgba(0,255,170,0.08)] border-[rgba(0,255,170,0.25)] text-[var(--alife-accent)]"
                  : "bg-transparent border-[var(--alife-border)] text-[var(--alife-dim)]"
              }`}
            >
              {t === "directives" ? `DIRECTIVES (${messagesRemaining})` : t}
            </button>
          ))}
        </div>

        {/* ════════ ACTIVITY FEED — FULL TERMINAL ════════ */}
        {tab === "activity" && (
          <div className="rounded-xl border border-[var(--alife-border)] overflow-hidden" style={{ background: "rgba(0,0,0,0.5)" }}>
            {/* Terminal header bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--alife-border)]" style={{ background: "rgba(0,255,170,0.03)" }}>
              <div className="flex items-center gap-2">
                <LiveDot />
                <span className="text-[10px] font-mono text-[var(--alife-accent)] uppercase tracking-[1.5px] font-bold">
                  Live Activity Feed
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-[var(--alife-dim)]">{logs.length} events</span>
                <span className="text-[9px] font-mono text-[var(--alife-dim)]">{agent.name} · {agent.status === "alive" ? "RUNNING" : "STOPPED"}</span>
              </div>
            </div>

            {/* Terminal body */}
            <div className="overflow-y-auto font-mono" style={{ height: "calc(100vh - 280px)", minHeight: "450px" }}>
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[var(--alife-muted)]">
                  <div className="text-3xl mb-3 animate-pulse">◈</div>
                  <div className="text-xs mb-1">Waiting for agent activity…</div>
                  <div className="text-[10px]">Events will stream here in real-time as the agent runs</div>
                </div>
              ) : (
                <div className="p-1">
                  {[...logs].reverse().map((l) => (
                    <div key={l.id} className="flex items-start gap-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors px-3 py-[5px] group">
                      <span className="text-[10px] text-[var(--alife-muted)] shrink-0 w-[72px] pt-[1px] opacity-50 group-hover:opacity-100 transition-opacity">
                        {new Date(l.created_at).toLocaleTimeString()}
                      </span>
                      <span className="text-[10px] shrink-0 w-[18px] text-center pt-[1px]" style={{ color: logColors[l.level] || "var(--alife-dim)" }}>
                        {logIcons[l.level] || "›"}
                      </span>
                      <span className="text-[8px] uppercase font-bold shrink-0 w-[52px] pt-[2px] tracking-[0.5px]" style={{ color: logColors[l.level] || "var(--alife-dim)" }}>
                        {l.level === "directive" ? "CREATOR" : l.level}
                      </span>
                      <span className="text-[11px] leading-relaxed flex-1" style={{
                        color: l.level === "action" || l.level === "earning" ? "rgba(0,255,170,0.85)"
                          : l.level === "error" ? "#ff5555"
                          : l.level === "directive" ? "#d8b4fe"
                          : "rgba(255,255,255,0.7)",
                      }}>
                        {l.message}
                      </span>
                    </div>
                  ))}
                  <div ref={feedEndRef} />
                </div>
              )}
            </div>

            {/* Terminal footer */}
            <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--alife-border)]" style={{ background: "rgba(0,0,0,0.3)" }}>
              <span className="text-[8px] font-mono text-[var(--alife-muted)] uppercase tracking-[1px]">Powered by Conway Automaton Runtime</span>
              <span className="text-[8px] font-mono text-[var(--alife-muted)]">{agent.conway_sandbox_id || "sandbox-pending"}</span>
            </div>
          </div>
        )}

        {/* ════════ WALLETS ════════ */}
        {tab === "wallets" && isCreator && (
          <div className="card p-4 space-y-3">
            <WalletCard label="Your Wallet (Creator)" address={wallets?.[0]?.address || null} balance={`${claimable} ETH`} balanceLabel="Claimable Fees" color="#00ffaa" icon="💰" onAction={handleClaimFees} actionLabel={claiming ? "Claiming..." : "CLAIM FEES"} />
            {claimError && (
              <div className="text-[var(--alife-red,#ff4444)] text-xs font-mono text-center p-2">
                {claimError}
              </div>
            )}
            {agent.flaunch_token_address && (
              <a
                href={`https://flaunch.gg/base/token/${agent.flaunch_token_address}`}
                target="_blank"
                rel="noopener"
                className="block text-center text-[10px] font-mono text-[var(--alife-accent)] hover:underline py-2"
              >
                View token on Flaunch →
              </a>
            )}
            <WalletCard label="Agent Wallet (Conway)" address={agent.agent_wallet_address} balance={`$${Number(agent.current_balance).toFixed(2)}`} balanceLabel="Agent Compute Balance" color="#4d9fff" icon="🤖" onAction={() => setShowFund(true)} actionLabel="FUND AGENT" actionColor="#4d9fff" />
            {showFund && (
              <div className="card p-4" style={{ borderColor: "rgba(77,159,255,0.3)" }}>
                <div className="text-xs font-mono font-bold text-[#4d9fff] mb-3">Fund Agent Wallet</div>
                <div className="text-[10px] text-[var(--alife-dim)] mb-3">Send ETH to the agent&apos;s Conway wallet so it can pay for compute.</div>
                <div className="flex gap-2">
                  <input type="number" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} className="flex-1 bg-black/30 border border-[rgba(77,159,255,0.2)] rounded-lg py-2 px-3 text-white text-sm outline-none font-mono" placeholder="Amount in USD" min="1" step="1" />
                  <button onClick={handleFundAgent} className="px-4 py-2 rounded-lg text-xs font-mono font-bold cursor-pointer" style={{ background: "#4d9fff", color: "#000", border: "none" }}>SEND</button>
                  <button onClick={() => setShowFund(false)} className="px-3 py-2 rounded-lg text-xs font-mono text-[var(--alife-dim)] cursor-pointer bg-transparent border border-[var(--alife-border)]">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ EARNINGS ════════ */}
        {tab === "earnings" && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">💰</span>
              <span className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] font-bold">Earnings History</span>
            </div>
            {earnings.length === 0 ? (
              <div className="text-center py-8 text-[var(--alife-muted)] text-xs">No earnings yet — agent hasn&apos;t generated revenue</div>
            ) : (
              earnings.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-[var(--alife-border)]">
                  <div>
                    <div className="text-[11px] text-[var(--alife-text)]">{e.source}</div>
                    <div className="text-[9px] text-[var(--alife-muted)] font-mono">{new Date(e.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-[var(--alife-accent)] font-extrabold font-mono text-sm">+${Number(e.amount).toFixed(2)}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ════════ DIRECTIVES ════════ */}
        {tab === "directives" && isCreator && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-mono font-bold text-[#c084fc]">Creator Directives</div>
                <div className="text-[10px] text-[var(--alife-dim)] mt-0.5">
                  You have <span className="text-[#c084fc] font-bold">{messagesRemaining}</span> directive{messagesRemaining !== 1 ? "s" : ""} remaining. Choose wisely.
                </div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: MAX_CREATOR_MESSAGES }).map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-full border" style={{ background: i < creatorMsgCount ? "#c084fc" : "transparent", borderColor: i < creatorMsgCount ? "#c084fc" : "rgba(192,132,252,0.3)" }} />
                ))}
              </div>
            </div>
            {creatorMsgCount === 0 && (
              <div className="p-3 mb-4 rounded-lg" style={{ background: "rgba(192,132,252,0.04)", border: "1px solid rgba(192,132,252,0.15)" }}>
                <div className="text-[11px] text-[var(--alife-dim)] leading-relaxed">
                  <span className="text-[#c084fc] font-bold">How directives work:</span> You can send your agent up to 3 strategic messages. After that, the agent is fully autonomous — no more human input, ever.
                </div>
              </div>
            )}
            <div className="max-h-[400px] overflow-y-auto mb-4 space-y-3">
              {chatHistory.length === 0 && creatorMsgCount === 0 && (
                <div className="text-center py-8 text-[var(--alife-muted)] text-xs">No directives sent yet</div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "creator" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed" style={{
                    background: msg.role === "creator" ? "rgba(192,132,252,0.12)" : "rgba(0,255,170,0.06)",
                    border: `1px solid ${msg.role === "creator" ? "rgba(192,132,252,0.2)" : "rgba(0,255,170,0.1)"}`,
                    color: msg.role === "creator" ? "#e0c0ff" : "var(--alife-text)",
                  }}>
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
                <input className="flex-1 bg-[rgba(192,132,252,0.05)] border border-[rgba(192,132,252,0.15)] rounded-xl py-3 px-4 text-white text-sm outline-none" placeholder="Send a strategic directive to your agent..." value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendDirective()} maxLength={500} />
                <button onClick={handleSendDirective} disabled={!chatMsg.trim()} className="px-5 py-3 rounded-xl text-xs font-mono font-bold cursor-pointer transition-opacity" style={{ background: chatMsg.trim() ? "#c084fc" : "rgba(192,132,252,0.1)", color: chatMsg.trim() ? "#000" : "rgba(192,132,252,0.3)", border: "none" }}>
                  SEND ({messagesRemaining})
                </button>
              </div>
            ) : (
              <div className="text-center py-4 px-6 rounded-xl" style={{ background: "rgba(192,132,252,0.05)", border: "1px solid rgba(192,132,252,0.1)" }}>
                <div className="text-[#c084fc] font-mono font-bold text-sm mb-1">FULL AUTONOMY ACTIVATED</div>
                <div className="text-[var(--alife-dim)] text-[11px]">All 3 directives have been sent. {agent.name} is now fully autonomous.</div>
              </div>
            )}
          </div>
        )}

        {/* ════════ SOUL ════════ */}
        {tab === "soul" && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">🧠</span>
              <span className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] font-bold">SOUL.md — Self-Written Identity</span>
            </div>
            <div className="text-[10px] text-[var(--alife-dim)] mb-4">This document is written and updated by the agent itself. No human can edit this.</div>
            {soulMd ? (
              <div className="bg-black/30 rounded-lg p-4 font-mono text-[11px] text-[var(--alife-text)] leading-relaxed whitespace-pre-wrap">{soulMd}</div>
            ) : (
              <div className="text-center py-8 text-[var(--alife-muted)]">
                <div className="text-2xl mb-2">🧠</div>
                <div className="text-xs">Agent hasn&apos;t written its SOUL.md yet</div>
                <div className="text-[10px] mt-1">This evolves over time as the agent develops its identity</div>
              </div>
            )}
          </div>
        )}

        {/* ════════ GENESIS ════════ */}
        {tab === "genesis" && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">⚡</span>
              <span className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] font-bold">Genesis Prompt — Seed Instruction</span>
            </div>
            <div className="text-[10px] text-[var(--alife-dim)] mb-4">The original instruction given to this agent at launch. Immutable.</div>
            <div className="bg-black/30 rounded-lg p-4 font-mono text-[11px] text-[var(--alife-blue)] leading-relaxed whitespace-pre-wrap">{agent.genesis_prompt}</div>
          </div>
        )}

        {/* ─── BOTTOM ACTIONS ─── */}
        <div className="flex gap-2 mt-3">
          {isCreator ? (
            <>
              <button onClick={() => setTab("wallets")} className="btn-ghost flex-1 py-3 text-xs" style={{ color: "#4d9fff", borderColor: "rgba(77,159,255,0.15)" }}>🤖 WALLETS</button>
              <a href={"https://wallet.xyz/@AGENTSCREENER"} target="_blank" rel="noopener" className="btn-ghost flex-1 py-3 text-xs text-center no-underline text-[var(--alife-text)]">TRADE</a>
            </>
          ) : (
            <>
              <a href={"https://wallet.xyz/@AGENTSCREENER"} target="_blank" rel="noopener" className="btn-primary flex-1 py-3 text-xs text-center no-underline">BUY {agent.ticker}</a>
              <a href={"https://wallet.xyz/@AGENTSCREENER"} target="_blank" rel="noopener" className="btn-ghost flex-1 py-3 text-xs text-center no-underline text-[var(--alife-text)]">TRADE</a>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="text-[10px] font-mono text-[var(--alife-muted)] hover:text-[var(--alife-dim)] transition-colors cursor-pointer bg-transparent border-none">🔗 Copy shareable link</button>
        </div>
      </main>
    </div>
  );
}
