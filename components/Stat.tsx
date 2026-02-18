"use client";

interface StatProps {
  label: string;
  value: string | number;
  color?: string;
}

export default function Stat({ label, value, color = "var(--alife-accent)" }: StatProps) {
  return (
    <div className="card p-4 text-center">
      <div className="text-[var(--alife-dim)] text-[9px] uppercase tracking-[2px] font-mono mb-2">
        {label}
      </div>
      <div
        className="text-[22px] font-extrabold font-mono leading-tight"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
