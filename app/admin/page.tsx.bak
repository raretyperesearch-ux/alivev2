"use client";

import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, custom, http, formatEther } from "viem";
import { base } from "viem/chains";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const ALIFE_TREASURY = "0xA660a38f40a519F2E351Cc9A5CA2f5feE1a9BE0D";

// Only these wallets can access the admin page
const ADMIN_WALLETS = [
  "0xa660a38f40a519f2e351cc9a5ca2f5fee1a9be0d",
  "0x73927100dcfa2c29dd330191a291d42560c90e8e",
];

interface AgentFeeInfo {
  id: string;
  name: string;
  token_address: string | null;
  split_manager_address: string | null;
  claimable: string;
}

export default function AdminPage() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState<AgentFeeInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState("");

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

  // Load agents and check their claimable fees
  const loadAgentFees = async () => {
    setLoadingAgents(true);
    try {
      const { data: agentsData } = await supabase
        .from("agents")
        .select("id, name, token_address, split_manager_address")
        .not("token_address", "is", null);

      if (!agentsData || agentsData.length === 0) {
        setAgents([]);
        setLoadingAgents(false);
        return;
      }

      const { getPlatformClaimableBalance } = await import("@/lib/flaunch");

      const withBalances = await Promise.all(
        agentsData.map(async (a) => {
          let claimable = "0";
          if (a.split_manager_address) {
            try {
              const bal = await getPlatformClaimableBalance(a.split_manager_address as `0x${string}`);
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
    if (!wallet || !agent.split_manager_address) return;
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
      const txHash = await claimPlatformFees(wc, agent.split_manager_address as `0x${string}`);
      setClaimStatus(`✅ Claimed! ${txHash.slice(0, 14)}…`);

      // Refresh
      await loadAgentFees();
    } catch (err: any) {
      console.error("Claim error:", err);
      setError(err.message || "Claim failed");
      setClaimStatus("");
    } finally {
      setClaimingId(null);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="max-w-[600px] mx-auto p-6 text-center py-20">
          <div className="text-3xl mb-4">◈</div>
          <p className="text-[var(--alife-dim)] mb-4">Connect wallet to access admin</p>
          <button onClick={login} className="btn-primary px-6 py-3 text-sm">
            CONNECT WALLET
          </button>
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

  return (
    <div className="min-h-screen bg-[var(--alife-bg)]">
      <Navbar />
      <main className="max-w-[700px] mx-auto p-6">
        <h1 className="font-display text-2xl font-extrabold text-white mb-1">◈ ALiFe Admin</h1>
        <p className="text-[var(--alife-dim)] text-xs mb-8">Platform fee management</p>

        {/* Wallet Info */}
        <div className="card p-4 mb-6">
          <div className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] mb-2">
            Connected Wallet
          </div>
          <code className="text-[var(--alife-accent)] text-sm font-mono">{wallet?.address}</code>
          <div className="mt-3">
            <button onClick={checkBalance} className="btn-ghost px-3 py-1.5 text-[10px]">
              CHECK BASE BALANCE
            </button>
            {balance !== null && (
              <span className="ml-3 text-[var(--alife-accent)] font-mono text-sm font-bold">
                {parseFloat(balance).toFixed(6)} ETH
              </span>
            )}
          </div>
        </div>

        {/* Platform Fee Claims */}
        <div className="card p-5 mb-6" style={{ border: "1px solid rgba(0,232,92,0.3)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono font-bold text-[var(--alife-accent)]">
              💰 Platform Fees (30%)
            </h2>
            <button
              onClick={loadAgentFees}
              disabled={loadingAgents}
              className="btn-ghost px-3 py-1.5 text-[10px]"
            >
              {loadingAgents ? "LOADING..." : "REFRESH ALL"}
            </button>
          </div>

          <div className="text-[11px] text-[var(--alife-dim)] leading-relaxed mb-4">
            Each agent token has its own SplitManager. Claim your 30% from each below.
          </div>

          {agents.length === 0 && !loadingAgents && (
            <div className="text-[var(--alife-dim)] text-xs text-center py-4">
              No agents with tokens found. Hit REFRESH ALL to load.
            </div>
          )}

          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between p-3 rounded-lg mb-2"
              style={{ background: "rgba(0,232,92,0.04)", border: "1px solid rgba(0,232,92,0.1)" }}
            >
              <div>
                <div className="text-white text-xs font-bold">{agent.name}</div>
                <div className="text-[var(--alife-dim)] text-[9px] font-mono">
                  {agent.split_manager_address
                    ? `SM: ${agent.split_manager_address.slice(0, 10)}…${agent.split_manager_address.slice(-6)}`
                    : "No SplitManager"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[var(--alife-accent)] font-mono text-sm font-bold">
                  {agent.claimable} ETH
                </span>
                <button
                  onClick={() => handleClaim(agent)}
                  disabled={!agent.split_manager_address || claimingId === agent.id || agent.claimable === "0" || agent.claimable === "0.000000"}
                  className="btn-primary px-3 py-1.5 text-[10px]"
                  style={{
                    opacity: (!agent.split_manager_address || agent.claimable === "0" || agent.claimable === "0.000000") ? 0.4 : 1,
                  }}
                >
                  {claimingId === agent.id ? "..." : "CLAIM"}
                </button>
              </div>
            </div>
          ))}

          {claimStatus && (
            <div className="mt-3 text-[11px] font-mono text-[var(--alife-accent)]">{claimStatus}</div>
          )}
          {error && (
            <div className="mt-3 text-[11px] font-mono text-[var(--alife-red)]">❌ {error}</div>
          )}
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
          <div className="text-[10px] text-[var(--alife-dim)] font-mono mt-1">
            Manager: AddressFeeSplitManager (per-token, no deploy needed)
          </div>
        </div>

        {/* Env Vars Checklist */}
        <div className="card p-5">
          <h2 className="text-sm font-mono font-bold text-white mb-3">
            Vercel Environment Variables
          </h2>
          <div className="space-y-2 text-[11px] font-mono">
            {[
              { key: "NEXT_PUBLIC_PRIVY_APP_ID", set: true },
              { key: "NEXT_PUBLIC_SUPABASE_URL", set: true },
              { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", set: true },
              { key: "NEXT_PUBLIC_ALIFE_TREASURY", set: !!process.env.NEXT_PUBLIC_ALIFE_TREASURY },
              { key: "CONWAY_API_URL", set: !!process.env.CONWAY_API_URL },
              { key: "CONWAY_API_KEY", set: !!process.env.CONWAY_API_KEY },
            ].map((v) => (
              <div key={v.key} className="flex items-center gap-2">
                <span className={v.set ? "text-[var(--alife-accent)]" : "text-[var(--alife-red)]"}>
                  {v.set ? "✓" : "✗"}
                </span>
                <span className="text-[var(--alife-dim)]">{v.key}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
