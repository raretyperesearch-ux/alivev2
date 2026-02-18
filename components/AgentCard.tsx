"use client";

import Link from "next/link";
import TierBadge, { tierColor } from "./TierBadge";
import { Agent } from "@/lib/supabase";

export default function AgentCard({ agent }: { agent: Agent }) {
  const tc = tierColor(agent.survival_tier);
  const isAlive = agent.survival_tier !== "dead";

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

        {/* Bottom row: stats */}
        <div className="flex items-center gap-4 pl-[52px]">
          <div>
            <div className="font-mono font-bold text-[13px]" style={{ color: "var(--accent)" }}>
              ${Number(agent.total_earned).toFixed(0)}
            </div>
            <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>earned</div>
          </div>
          <div>
            <div className="font-mono font-semibold text-[13px]" style={{ color: "var(--blue)" }}>
              ${Number(agent.current_balance).toFixed(0)}
            </div>
            <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>MC</div>
          </div>
          <div>
            <div className="font-mono font-semibold text-[13px]" style={{ color: "var(--amber)" }}>
              ${Number(agent.total_trading_fees || 0).toFixed(0)}
            </div>
            <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>vol</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
