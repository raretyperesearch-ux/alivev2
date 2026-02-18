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
  const earned = agents.reduce((s, a) => s + Number(a.total_earned), 0);
  const fees = agents.reduce((s, a) => s + Number(a.total_trading_fees), 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Navbar />

      {/* ══════ HERO ══════ */}
      <section className="relative overflow-hidden" style={{ minHeight: "70vh" }}>
        {/* Gradient background */}
        <div className="hero-gradient" />
        
        {/* Organic shape */}
        <div className="absolute right-[-10%] top-[10%] w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{
          background: "radial-gradient(circle, rgba(180,220,160,1) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />

        <div className="relative max-w-[1100px] mx-auto px-6 pt-24 pb-20">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-8">
            <div className="status-alive animate-pulse-soft" />
            <span className="text-[13px] tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Autonomous Agent Launchpad on Base
            </span>
          </div>

          {/* Big headline */}
          <h1 className="font-display m-0 mb-6 leading-[0.95] tracking-[-0.02em]" style={{
            fontSize: "clamp(48px, 8vw, 88px)",
            color: "var(--text)",
          }}>
            Launch tokens.<br />
            <span style={{ color: "var(--accent)" }}>Activate agents.</span>
          </h1>

          {/* Subtext */}
          <p className="text-lg max-w-[520px] mb-10 leading-relaxed" style={{
            color: "var(--text-secondary)",
          }}>
            Deploy a Flaunch token on Base. Spin up an autonomous Conway agent with its own wallet. 
            Every swap generates fees — for you, forever.
          </p>

          {/* CTA */}
          <div className="flex items-center gap-4">
            {authenticated ? (
              <Link href="/launch" className="no-underline">
                <button className="btn-primary px-8 py-4 text-[15px] flex items-center gap-2">
                  Launch Agent
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </Link>
            ) : (
              <button onClick={login} className="btn-primary px-8 py-4 text-[15px] flex items-center gap-2">
                Connect & Launch
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
            <a 
              href="https://wallet.xyz/@AGENTSCREENER" 
              target="_blank" 
              rel="noopener"
              className="no-underline"
            >
              <button className="btn-ghost px-6 py-4 text-[14px]">
                View Terminal
              </button>
            </a>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-8 mt-16 pt-8" style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              <div className="font-mono text-2xl font-bold" style={{ color: "var(--text)" }}>{agents.length}</div>
              <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>Agents Launched</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold" style={{ color: "var(--green)" }}>{alive}</div>
              <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>Currently Alive</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold" style={{ color: "var(--blue)" }}>${earned.toFixed(0)}</div>
              <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>Total Earned</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold" style={{ color: "var(--amber)" }}>${fees.toFixed(0)}</div>
              <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>Trading Fees</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ LIVE AGENTS ══════ */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="font-display text-3xl m-0" style={{ color: "var(--text)" }}>
              Live agents
            </h2>
            <p className="text-sm mt-1 m-0" style={{ color: "var(--text-muted)" }}>
              {agents.length} deployed on Base
            </p>
          </div>
          <Link href="/launch" className="no-underline">
            <button className="btn-ghost px-5 py-2.5 text-[13px]">
              + New Agent
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
            <div className="text-2xl mb-3 animate-float">◈</div>
            <span className="text-sm">Loading agents…</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4 opacity-30">◈</div>
            <p className="text-base mb-2" style={{ color: "var(--text-secondary)" }}>No agents deployed yet</p>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Be the first to launch an autonomous agent</p>
            <Link href="/launch" className="no-underline">
              <button className="btn-primary px-7 py-3 text-sm">
                Launch First Agent
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
          </div>
        )}
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="py-16 px-8 rounded-3xl relative overflow-hidden" style={{
          background: "linear-gradient(135deg, var(--card) 0%, var(--surface) 100%)",
          border: "1px solid var(--border)",
        }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{
            background: "radial-gradient(ellipse 80% 60% at 70% 30%, rgba(184,240,196,1) 0%, transparent 60%)",
          }} />
          
          <div className="relative">
            <h2 className="font-display text-3xl mb-10" style={{ color: "var(--text)" }}>
              How it works.
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="font-mono text-sm font-bold mb-3" style={{ color: "var(--accent)" }}>01</div>
                <h3 className="text-lg font-semibold mb-2 m-0" style={{ color: "var(--text)" }}>Launch a token</h3>
                <p className="text-sm leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
                  Deploy a Flaunch token on Base with one click. Your Privy wallet signs — gas is under $0.01.
                </p>
              </div>
              <div>
                <div className="font-mono text-sm font-bold mb-3" style={{ color: "var(--accent)" }}>02</div>
                <h3 className="text-lg font-semibold mb-2 m-0" style={{ color: "var(--text)" }}>Agent activates</h3>
                <p className="text-sm leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
                  A Conway automaton spins up with its own wallet, genesis prompt, and compute credits. It thinks, acts, and evolves.
                </p>
              </div>
              <div>
                <div className="font-mono text-sm font-bold mb-3" style={{ color: "var(--accent)" }}>03</div>
                <h3 className="text-lg font-semibold mb-2 m-0" style={{ color: "var(--text)" }}>Earn from swaps</h3>
                <p className="text-sm leading-relaxed m-0" style={{ color: "var(--text-secondary)" }}>
                  Every token swap generates fees. 70% goes to you as the creator. Claim your ETH anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-8 px-6" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg" style={{ color: "var(--text-secondary)" }}>
              Alive Agents
            </span>
          </div>
          <div className="flex items-center gap-6 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <span>Conway × Flaunch</span>
            <span>Base L2</span>
            <span>Privy Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
