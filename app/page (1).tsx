"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Navbar from "@/components/Navbar";
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
  const totalVolume = agents.reduce((s, a) => s + Number(a.volume_24h_usd || 0), 0);

  const formatVolume = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Navbar />

      <main className="max-w-[920px] mx-auto pb-10">
        {/* Hero */}
        <div className="text-center pt-14 pb-10 px-5 relative">
          <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] pointer-events-none" style={{
            background: "radial-gradient(ellipse 100% 80% at 50% 30%, rgba(140, 200, 150, 0.07) 0%, rgba(160, 150, 90, 0.03) 40%, transparent 70%)",
          }} />

          <div className="relative">
            <div className="text-[11px] tracking-[6px] uppercase mb-5" style={{ color: "var(--text-muted)" }}>
              Autonomous Agent Launchpad
            </div>

            <h1 className="font-display m-0 mb-2 leading-tight tracking-[-0.02em]" style={{
              fontSize: "clamp(38px, 6vw, 56px)",
              color: "var(--text)",
            }}>
              Alive <span style={{ color: "var(--accent)" }}>Agents</span> v2
            </h1>

            <p className="text-[15px] max-w-[480px] mx-auto mt-3 mb-8 leading-relaxed" style={{
              color: "var(--text-secondary)",
            }}>
              Launch a token. Activate an autonomous AI agent.
              <br />
              It earns. You earn.{" "}
              <span style={{ color: "var(--accent)" }}>Powered by Conway.</span>
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
        </div>

        {/* Stats — Launched / Alive / Volume */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 px-4 mb-8">
          {[
            { label: "Launched", value: agents.length, color: "var(--text)" },
            { label: "Alive", value: alive, color: "var(--green)" },
            { label: "Volume", value: formatVolume(totalVolume), color: "var(--blue)" },
          ].map((stat, i) => (
            <div key={i} className="card px-3 sm:px-4 py-3 text-center">
              <div className="font-mono text-lg sm:text-xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-[10px] sm:text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Agent List */}
        <div className="px-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold tracking-wide m-0" style={{ color: "var(--text)" }}>
              LIVE AGENTS
            </h2>
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {agents.length} deployed
            </span>
          </div>

          {loading ? (
            <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
              <div className="text-xl mb-2 animate-float">◈</div>
              <span className="text-xs">Loading agents…</span>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-3xl mb-4 opacity-30">◈</div>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>No agents deployed yet</p>
              <Link href="/launch" className="no-underline">
                <button className="btn-primary px-6 py-2.5 text-xs">
                  BE THE FIRST ⚡
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-5 text-[11px]" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
        Alive Agents v2 · Conway × Flaunch · Privy · Base L2
      </footer>
    </div>
  );
}
