"use client";

import { SurvivalTier } from "@/lib/supabase";

const tierConfig: Record<SurvivalTier, { label: string; color: string }> = {
  normal: { label: "ALIVE", color: "#00e85c" },
  low_compute: { label: "LOW", color: "#fcd34d" },
  critical: { label: "CRITICAL", color: "#fb7185" },
  dead: { label: "DEAD", color: "#555" },
};

export default function TierBadge({ tier }: { tier: SurvivalTier }) {
  const { label, color } = tierConfig[tier];

  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[2px] text-[9px] font-extrabold font-mono tracking-[1.5px]"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}40`,
        color,
      }}
    >
      <span
        className="w-[5px] h-[5px] rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {label}
    </span>
  );
}

export function tierColor(tier: SurvivalTier): string {
  return tierConfig[tier].color;
}
