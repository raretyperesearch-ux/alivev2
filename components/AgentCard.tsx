"use client";

import Link from "next/link";
import { useState } from "react";
import TierBadge, { tierColor } from "./TierBadge";
import { Agent } from "@/lib/supabase";

export default function AgentCard({ agent }: { agent: Agent }) {
  const tc = tierColor(agent.survival_tier);
  const isAlive = agent.survival_tier !== "dead";
  const [copied, setCopied] = useState(false);

  const copyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (agent.flaunch_token_address) {
      navigator.clipboard.writeText(agent.flaunch_token_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Link href={`/agent/${agent.id}`} className="no-underline block">
      <div className="card px-4 py-3.5 cursor-pointer group">
        {/* Top row: avatar + name + tier */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{
              background: `${tc}10`,
              border: `1.5px solid ${tc}25`,
              color: tc,
            }}
          >
            {agent.name[0]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>{agent.name}</span>
              <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                {agent.ticker}
              </span>
              <TierBadge tier={agent.survival_tier} />
              {isAlive && <span className="status-alive animate-pulse-soft" />}
            </div>
            <div className="text-[12px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {agent.description}
            </div>
          </div>

          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-20 group-hover:opacity-50 transition-opacity hidden sm:block" style={{ color: "var(--text-secondary)" }}>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Bottom row: CA + actions */}
        <div className="flex items-center gap-2 pl-[52px] flex-wrap">
          {/* Copy CA */}
          {agent.flaunch_token_address ? (
            <button
              onClick={copyCA}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer border"
              style={{
                background: copied ? "rgba(0,232,92,0.1)" : "rgba(255,255,255,0.03)",
                borderColor: copied ? "rgba(0,232,92,0.3)" : "var(--border)",
                color: copied ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {copied ? (
                <>✓ Copied</>
              ) : (
                <>
                  <span>CA</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {agent.flaunch_token_address.slice(0, 6)}…{agent.flaunch_token_address.slice(-4)}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
                    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 11V3.5A.5.5 0 013.5 3H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </>
              )}
            </button>
          ) : (
            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>No token</span>
          )}

          {/* Trade link */}
          <a
            href="https://wallet.xyz/@AGENTSCREENER"
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all no-underline border"
            style={{
              background: "rgba(0,232,92,0.06)",
              borderColor: "rgba(0,232,92,0.15)",
              color: "var(--accent)",
            }}
          >
            TRADE ↗
          </a>

          {/* Market cap if available */}
          {Number(agent.market_cap_usd) > 0 && (
            <span className="text-[10px] font-mono ml-auto" style={{ color: "var(--blue)" }}>
              MC ${Number(agent.market_cap_usd) >= 1000 
                ? `${(Number(agent.market_cap_usd) / 1000).toFixed(1)}k` 
                : Number(agent.market_cap_usd).toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
