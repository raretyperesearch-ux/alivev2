"use client";

interface FeeSplitProps {
  creator: number;
  platform: number;
}

export default function FeeSplit({ creator, platform }: FeeSplitProps) {
  const segments = [
    { label: "You (Creator)", pct: creator, color: "var(--alife-accent)" },
    { label: "ALiFe", pct: platform, color: "var(--alife-yellow)" },
  ];

  return (
    <div className="card px-4 py-3">
      <div className="flex gap-[2px] h-[5px] rounded-[3px] overflow-hidden mb-2">
        {segments.map((s, i) => (
          <div
            key={i}
            className="opacity-80"
            style={{ width: `${s.pct}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="flex gap-5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px]">
            <div
              className="w-[5px] h-[5px] rounded-sm"
              style={{ background: s.color }}
            />
            <span className="text-[var(--alife-dim)]">{s.label}</span>
            <span className="font-extrabold font-mono" style={{ color: s.color }}>
              {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
