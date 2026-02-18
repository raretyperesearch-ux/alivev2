"use client";

import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, custom, http, formatEther } from "viem";
import { base } from "viem/chains";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const ALIFE_TREASURY = "0xA660a38f40a519F2E351Cc9A5CA2f5feE1a9BE0D";

const ADMIN_WALLETS = [
  "0xa660a38f40a519f2e351cc9a5ca2f5fee1a9be0d",
  "0x73927100dcfa2c29dd330191a291d42560c90e8e",
];

interface AgentFeeInfo {
  id: string;
  name: string;
  flaunch_token_address: string | null;
  split_manager_address: string | null;
  claimable: string;
}

interface AgentFundingInfo {
  id: string;
  name: string;
  ticker: string;
  status: string;
  agent_wallet_address: string | null;
  created_at: string;
  needsFunding: boolean;
  lastCredits: string;
  isDead: boolean;
}

export default function AdminPage() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState<AgentFeeInfo[]>([]);
  const [fundingAgents, setFundingAgents] = useState<AgentFundingInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingFunding, setLoadingFunding] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState("");
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

  const wallet = wallets?.[0];
  const isAdmin = wallet && ADMIN_WALLETS.includes(wallet.address.toLowerCase());

  const checkBalance = async () => {
    if (!wallet) return;
    try {
      const pc = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
      const bal = await pc.getBalance({ address: wallet.address as `0x${string}` });
      setBalance(formatEther(bal));
    } catch (err: any) {
      setError("Failed to check balance: " + err.message);
    }
  };

  // Load agents needing funding
  const loadFundingStatus = async () => {
    setLoadingFunding(true);
    try {
      const { data: agentsData } = await supabase
        .from("agents")
        .select("id, name, ticker, status, agent_wallet_address, created_at")
        .not("agent_wallet_address", "is", null)
        .neq("agent_wallet_address", "pending")
        .order("created_at", { ascending: false });

      if (!agentsData || agentsData.length === 0) {
        setFundingAgents([]);
        setLoadingFunding(false);
        return;
      }

      const withStatus = await Promise.all(
        agentsData.map(async (a) => {
          const { data: creditLogs } = await supabase
            .from("agent_logs")
            .select("message")
            .eq("agent_id", a.id)
            .like("message", "%Credits: $%")
            .order("created_at", { ascending: false })
            .limit(1);

          const { data: deathLogs } = await supabase
            .from("agent_logs")
            .select("message")
            .eq("agent_id", a.id)
            .like("message", "%DEAD%")
            .order("created_at", { ascending: false })
            .limit(1);

          let lastCredits = "unknown";
          let needsFunding = true;
          if (creditLogs && creditLogs.length > 0) {
            const match = creditLogs[0].message.match(/Credits: \$([0-9.]+)/);
            if (match) {
              lastCredits = `$${match[1]}`;
              needsFunding = parseFloat(match[1]) === 0;
            }
          }

          return {
            ...a,
            needsFunding,
            lastCredits,
            isDead: !!(deathLogs && deathLogs.length > 0),
          };
        })
      );

      setFundingAgents(withStatus);
    } catch (err: any) {
      console.error("Failed to load funding status:", err);
    } finally {
      setLoadingFunding(false);
    }
  };

  const copyWallet = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedWallet(addr);
    setTimeout(() => setCopiedWallet(null), 1500);
  };

  const copyFundCommand = (addr: string) => {
    navigator.clipboard.writeText(`conway credits transfer ${addr} 1.00`);
    setCopiedWallet("cmd-" + addr);
    setTimeout(() => setCopiedWallet(null), 1500);
  };

  const loadAgentFees = async () => {
    setLoadingAgents(true);
    try {
      const { data: agentsData } = await supabase
        .from("agents")
        .select("id, name, flaunch_token_address, split_manager_address")
        .not("flaunch_token_address", "is", null);

      if (!agentsData || agentsData.length === 0) {
        setAgents([]);
        setLoadingAgents(false);
        return;
      }

      const { getPlatformClaimableBalance } = await import("@/lib/flaunch");

      const withBalances = await Promise.all(
        agentsData.map(async (a) => {
          let claimable = "0";
          if (a.flaunch_token_address) {
            try {
              const bal = await getPlatformClaimableBalance(a.flaunch_token_address as `0x${string}`);
              claimable = parseFloat(formatEther(bal)).toFixed(6);
            } catch {}
          }
          return { ...a, claimable };
        })
      );

      setAgents(withBalances);
    } catch (err: any) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleClaim = async (agent: AgentFeeInfo) => {
    if (!wallet || !agent.flaunch_token_address) return;
    setClaimingId(agent.id);
    setClaimStatus("Sign tx in wallet...");
    setError("");

    try {
      await wallet.switchChain(base.id);
      const provider = await wallet.getEthereumProvider();
      const wc = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: base,
        transport: custom(provider),
      });

      const { claimPlatformFees } = await import("@/lib/flaunch");
      const txHash = await claimPlatformFees(wc, agent.flaunch_token_address as `0x${string}`);
      setClaimStatus(`✅ Claimed! ${txHash.slice(0, 14)}…`);
      await loadAgentFees();
    } catch (err: any) {
      console.error("Claim error:", err);
      setError(err.message || "Claim failed");
      setClaimStatus("");
    } finally {
      setClaimingId(null);
    }
  };

  useEffect(() => {
    if (isAdmin) loadFundingStatus();
  }, [isAdmin]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="max-w-[600px] mx-auto p-6 text-center py-20">
          <div className="text-3xl mb-4">◈</div>
          <p className="text-[var(--alife-dim)] mb-4">Connect wallet to access admin</p>
          <button onClick={login} className="btn-primary px-6 py-3 text-sm">CONNECT WALLET</button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="max-w-[600px] mx-auto p-6 text-center py-20">
          <div className="text-3xl mb-4">🚫</div>
          <p className="text-[var(--alife-red)]">Not authorized</p>
          <p className="text-[var(--alife-dim)] text-xs mt-2">Wallet: {wallet?.address}</p>
        </div>
      </div>
    );
  }

  const needsFunding = fundingAgents.filter((a) => a.needsFunding);
  const funded = fundingAgents.filter((a) => !a.needsFunding);

  return (
    <div className="min-h-screen bg-[var(--alife-bg)]">
      <Navbar />
      <main className="max-w-[700px] mx-auto p-6">
        <h1 className="font-display text-2xl font-extrabold text-white mb-1">◈ ALiFe Admin</h1>
        <p className="text-[var(--alife-dim)] text-xs mb-8">Agent management & platform fees</p>

        {/* Wallet Info */}
        <div className="card p-4 mb-6">
          <div className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] mb-2">Connected Wallet</div>
          <code className="text-[var(--alife-accent)] text-sm font-mono">{wallet?.address}</code>
          <div className="mt-3">
            <button onClick={checkBalance} className="btn-ghost px-3 py-1.5 text-[10px]">CHECK BASE BALANCE</button>
            {balance !== null && (
              <span className="ml-3 text-[var(--alife-accent)] font-mono text-sm font-bold">
                {parseFloat(balance).toFixed(6)} ETH
              </span>
            )}
          </div>
        </div>

        {/* ═══ AGENT FUNDING STATUS ═══ */}
        <div className="card p-5 mb-6" style={{ border: "1px solid rgba(255,100,100,0.3)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono font-bold" style={{ color: "#ff6b6b" }}>
              ⚡ Agent Funding ({needsFunding.length} need credits)
            </h2>
            <button onClick={loadFundingStatus} disabled={loadingFunding} className="btn-ghost px-3 py-1.5 text-[10px]">
              {loadingFunding ? "LOADING..." : "REFRESH"}
            </button>
          </div>

          <div className="text-[11px] text-[var(--alife-dim)] leading-relaxed mb-4">
            Fund via CLI: <code className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(255,255,255,0.05)", color: "var(--alife-accent)" }}>conway credits transfer {"<wallet>"} 1.00</code>
          </div>

          {needsFunding.length === 0 && !loadingFunding && (
            <div className="text-[var(--alife-dim)] text-xs text-center py-3">All agents funded ✓</div>
          )}

          {needsFunding.map((agent) => (
            <div key={agent.id} className="p-3 rounded-lg mb-2" style={{ background: "rgba(255,100,100,0.06)", border: "1px solid rgba(255,100,100,0.15)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-white text-xs font-bold">{agent.name}</span>
                  <span className="text-[10px] font-mono text-[var(--alife-dim)]">{agent.ticker}</span>
                  {agent.isDead && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,100,100,0.15)", color: "#ff6b6b" }}>DEAD</span>
                  )}
                </div>
                <span className="text-[10px] font-mono" style={{ color: "#ff6b6b" }}>{agent.lastCredits}</span>
              </div>

              {agent.agent_wallet_address && (
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-[9px] font-mono text-[var(--alife-dim)] flex-1 truncate">{agent.agent_wallet_address}</code>
                  <button
                    onClick={() => copyWallet(agent.agent_wallet_address!)}
                    className="px-2 py-0.5 rounded text-[9px] font-mono border shrink-0"
                    style={{
                      background: copiedWallet === agent.agent_wallet_address ? "rgba(0,232,92,0.1)" : "rgba(255,255,255,0.03)",
                      borderColor: copiedWallet === agent.agent_wallet_address ? "rgba(0,232,92,0.3)" : "rgba(255,255,255,0.08)",
                      color: copiedWallet === agent.agent_wallet_address ? "var(--alife-accent)" : "var(--alife-dim)",
                    }}
                  >
                    {copiedWallet === agent.agent_wallet_address ? "✓" : "COPY"}
                  </button>
                  <button
                    onClick={() => copyFundCommand(agent.agent_wallet_address!)}
                    className="px-2 py-0.5 rounded text-[9px] font-mono border shrink-0"
                    style={{
                      background: copiedWallet === "cmd-" + agent.agent_wallet_address ? "rgba(0,232,92,0.1)" : "rgba(255,208,0,0.06)",
                      borderColor: copiedWallet === "cmd-" + agent.agent_wallet_address ? "rgba(0,232,92,0.3)" : "rgba(255,208,0,0.15)",
                      color: copiedWallet === "cmd-" + agent.agent_wallet_address ? "var(--alife-accent)" : "#ffd000",
                    }}
                  >
                    {copiedWallet === "cmd-" + agent.agent_wallet_address ? "✓ CMD" : "FUND CMD"}
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Already Funded */}
          {funded.length > 0 && (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] mb-2">Funded ({funded.length})</div>
              {funded.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-2 rounded-lg mb-1" style={{ background: "rgba(0,232,92,0.04)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-[11px] font-bold">{agent.name}</span>
                    <span className="text-[10px] font-mono text-[var(--alife-dim)]">{agent.ticker}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--alife-accent)]">{agent.lastCredits}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ PLATFORM FEE CLAIMS ═══ */}
        <div className="card p-5 mb-6" style={{ border: "1px solid rgba(0,232,92,0.3)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono font-bold text-[var(--alife-accent)]">💰 Platform Fees (30%)</h2>
            <button onClick={loadAgentFees} disabled={loadingAgents} className="btn-ghost px-3 py-1.5 text-[10px]">
              {loadingAgents ? "LOADING..." : "REFRESH ALL"}
            </button>
          </div>

          <div className="text-[11px] text-[var(--alife-dim)] leading-relaxed mb-4">
            Platform wallet holds all Flaunch NFTs. Claim fees per token, then pay creators their 70%.
          </div>

          {agents.length === 0 && !loadingAgents && (
            <div className="text-[var(--alife-dim)] text-xs text-center py-4">No agents with tokens found. Hit REFRESH ALL to load.</div>
          )}

          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg mb-2" style={{ background: "rgba(0,232,92,0.04)", border: "1px solid rgba(0,232,92,0.1)" }}>
              <div>
                <div className="text-white text-xs font-bold">{agent.name}</div>
                <div className="text-[var(--alife-dim)] text-[9px] font-mono">
                  {agent.flaunch_token_address ? `Token: ${agent.flaunch_token_address.slice(0, 10)}…${agent.flaunch_token_address.slice(-6)}` : "No token"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[var(--alife-accent)] font-mono text-sm font-bold">{agent.claimable} ETH</span>
                <button
                  onClick={() => handleClaim(agent)}
                  disabled={!agent.flaunch_token_address || claimingId === agent.id || agent.claimable === "0" || agent.claimable === "0.000000"}
                  className="btn-primary px-3 py-1.5 text-[10px]"
                  style={{ opacity: (!agent.flaunch_token_address || agent.claimable === "0" || agent.claimable === "0.000000") ? 0.4 : 1 }}
                >
                  {claimingId === agent.id ? "..." : "CLAIM"}
                </button>
              </div>
            </div>
          ))}

          {claimStatus && <div className="mt-3 text-[11px] font-mono text-[var(--alife-accent)]">{claimStatus}</div>}
          {error && <div className="mt-3 text-[11px] font-mono text-[var(--alife-red)]">❌ {error}</div>}
        </div>

        {/* Fee Split Info */}
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-mono font-bold text-white mb-3">Fee Split Info</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ background: "rgba(0,232,92,0.04)", border: "1px solid rgba(0,232,92,0.1)" }}>
              <div className="text-[9px] text-[var(--alife-dim)] font-mono uppercase">Creator</div>
              <div className="text-[var(--alife-accent)] font-mono font-bold text-lg">70%</div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "rgba(255,208,0,0.04)", border: "1px solid rgba(255,208,0,0.1)" }}>
              <div className="text-[9px] text-[var(--alife-dim)] font-mono uppercase">Platform</div>
              <div className="text-[var(--alife-yellow)] font-mono font-bold text-lg">30%</div>
            </div>
          </div>
          <div className="text-[10px] text-[var(--alife-dim)] font-mono">
            Treasury: <span className="text-[var(--alife-yellow)]">{ALIFE_TREASURY}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
