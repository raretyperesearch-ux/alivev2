"use client";

import Link from "next/link";
import TierBadge, { tierColor } from "./TierBadge";
import { Agent } from "@/lib/supabase";

export default function AgentCard({ agent }: { agent: Agent }) {
  const tc = tierColor(agent.survival_tier);
  const isAlive = agent.survival_tier !== "dead";

  return (
    <Link href={`/agent/${agent.id}`} className="no-underline block">
      <div className="card px-5 py-4 cursor-pointer flex items-center gap-4 group">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
          style={{
            background: `${tc}10`,
            border: `1.5px solid ${tc}25`,
            color: tc,
          }}
        >
          {agent.name[0]}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>{agent.name}</span>
            <span className="text-[12px] font-mono" style={{ color: "var(--text-muted)" }}>
              {agent.ticker}
            </span>
            <TierBadge tier={agent.survival_tier} />
            {isAlive && <span className="status-alive animate-pulse-soft" />}
          </div>
          <div className="text-[13px] truncate" style={{ color: "var(--text-secondary)" }}>
            {agent.description}
          </div>
        </div>

        {/* Earned */}
        <div className="text-right shrink-0">
          <div className="font-mono font-bold text-[15px]" style={{ color: "var(--accent)" }}>
            ${Number(agent.total_earned).toFixed(0)}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>earned</div>
        </div>

        {/* Balance */}
        <div className="text-right shrink-0 min-w-[60px]">
          <div className="font-mono font-semibold text-sm" style={{ color: tc }}>
            ${Number(agent.current_balance).toFixed(2)}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>balance</div>
        </div>

        {/* Arrow */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-20 group-hover:opacity-50 transition-opacity" style={{ color: "var(--text-secondary)" }}>
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  );
}
