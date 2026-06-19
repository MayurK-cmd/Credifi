import type { Tier } from "@/lib/mockData";

const TIER_COLOR: Record<Tier, string> = {
  A: "var(--tier-a)",
  B: "var(--tier-b)",
  C: "var(--tier-c)",
  D: "var(--tier-d)",
};

export function ScoreGauge({ score, tier, size = 200 }: { score: number; tier: Tier; size?: number }) {
  const pct = Math.min(1, Math.max(0, score / 1000));
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const color = TIER_COLOR[tier];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={10} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 800ms ease, stroke 400ms ease", filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-4xl font-semibold tabular-nums">{score}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Score · /1000</div>
          <div
            className="mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{ borderColor: color, color }}
          >
            Tier {tier}
          </div>
        </div>
      </div>
    </div>
  );
}
