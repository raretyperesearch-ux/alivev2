"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Navbar from "@/components/Navbar";
import Stat from "@/components/Stat";
import AgentCard from "@/components/AgentCard";
import { getAgents, Agent } from "@/lib/supabase";
import Link from "next/link";

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { login, authenticated } = usePrivy();

  useEffect(() => {
    getAgents()
      .then(setAgents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const alive = agents.filter((a) => !["dead"].includes(a.survival_tier)).length;
  const earned = agents.reduce((s, a) => s + Number(a.total_earned), 0);
  const fees = agents.reduce((s, a) => s + Number(a.total_trading_fees), 0);

  const handleLaunch = () => {
    if (!authenticated) {
      login();
      return;
    }
    // Navigate handled by Link
  };

  return (
    <div className="min-h-screen bg-[var(--alife-bg)]">
      <Navbar />

      <main className="max-w-[920px] mx-auto pb-10">
        {/* Hero */}
        <div className="text-center pt-14 pb-10 px-5 relative">
          <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[radial-gradient(ellipse,rgba(0,255,170,0.04)_0%,transparent_65%)] pointer-events-none" />

          <div className="font-mono text-[9px] text-[rgba(0,255,170,0.4)] tracking-[6px] uppercase mb-5">
            Autonomous Agent Launchpad
          </div>

          <h1 className="font-display text-[42px] font-extrabold text-white m-0 mb-2 leading-tight tracking-tight">
            Alive <span className="text-[var(--alife-accent)]">Agents</span> v2
          </h1>

          <p className="text-[var(--alife-dim)] text-[15px] max-w-[480px] mx-auto mt-3 mb-8 leading-relaxed">
            Launch a token. Activate an autonomous AI agent.
            <br />
            It earns. You earn.{" "}
            <span className="text-[var(--alife-accent)]">Powered by Conway.</span>
          </p>

          {authenticated ? (
            <Link href="/launch" className="no-underline">
              <button className="btn-primary px-8 py-3.5 text-[15px]">
                ⚡ LAUNCH AGENT
              </button>
            </Link>
          ) : (
            <button onClick={login} className="btn-primary px-8 py-3.5 text-[15px]">
              ⚡ CONNECT & LAUNCH
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 px-4 mb-8">
          <Stat label="Launched" value={agents.length} />
          <Stat label="Alive" value={alive} />
          <Stat label="Earned" value={`$${earned.toFixed(0)}`} color="var(--alife-blue)" />
          <Stat label="Fees" value={`$${fees.toFixed(0)}`} color="var(--alife-yellow)" />
        </div>

        {/* Agent List */}
        <div className="px-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-mono text-xs text-white tracking-[2px] font-bold m-0">
              LIVE AGENTS
            </h2>
            <span className="text-[var(--alife-muted)] text-[10px] font-mono">
              {agents.length} deployed
            </span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-[var(--alife-muted)]">
              <div className="text-xl mb-2">◈</div>
              <span className="font-mono text-xs">Loading agents…</span>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-3xl mb-4">◈</div>
              <p className="text-[var(--alife-dim)] text-sm mb-4">No agents deployed yet</p>
              <Link href="/launch" className="no-underline">
                <button className="btn-primary px-6 py-2.5 text-xs">
                  BE THE FIRST ⚡
                </button>
              </Link>
            </div>
          ) : (
            agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-5 border-t border-[var(--alife-border)] text-[var(--alife-muted)] text-[9px] font-mono tracking-[1px]">
        Alive Agents v2 · Conway × Flaunch · Privy · Base L2
      </footer>
    </div>
  );
}
