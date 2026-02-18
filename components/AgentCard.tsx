"use client";

import Link from "next/link";
import TierBadge, { tierColor } from "./TierBadge";
import { Agent } from "@/lib/supabase";

export default function AgentCard({ agent }: { agent: Agent }) {
  const tc = tierColor(agent.survival_tier);

  return (
    <Link href={`/agent/${agent.id}`} className="no-underline">
      <div className="card px-4 py-3.5 mb-2 cursor-pointer flex items-center gap-3 hover:border-[var(--alife-border-hover)] transition-colors">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-base font-extrabold font-mono"
          style={{
            background: `${tc}12`,
            border: `1px solid ${tc}30`,
            color: tc,
          }}
        >
          {agent.name[0]}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-white text-sm">{agent.name}</span>
            <span className="text-[rgba(0,255,170,0.35)] text-[10px] font-mono">
              {agent.ticker}
            </span>
            <TierBadge tier={agent.survival_tier} />
          </div>
          <div className="text-[var(--alife-dim)] text-[10px] truncate">
            {agent.description}
          </div>
        </div>

        {/* Earned */}
        <div className="text-right">
          <div className="font-mono font-extrabold text-[var(--alife-accent)] text-sm">
            ${Number(agent.total_earned).toFixed(0)}
          </div>
          <div className="text-[var(--alife-muted)] text-[9px] font-mono">earned</div>
        </div>

        {/* Balance */}
        <div className="text-right min-w-[55px]">
          <div className="font-mono font-bold text-xs" style={{ color: tc }}>
            ${Number(agent.current_balance).toFixed(2)}
          </div>
          <div className="text-[var(--alife-muted)] text-[9px] font-mono">bal</div>
        </div>

        <span className="text-[var(--alife-muted)] text-sm">›</span>
      </div>
    </Link>
  );
}
