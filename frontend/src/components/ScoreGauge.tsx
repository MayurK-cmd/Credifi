import { CountUp } from "./CountUp";
import type { Tier } from "@/lib/mockData";

const TIER_COLOR: Record<Tier, string> = {
  A: "var(--tier-a)",
  B: "var(--tier-b)",
  C: "var(--tier-c)",
  D: "var(--tier-d)",
};

export function ScoreGauge({
  score,
  tier,
  size = 220,
}: {
  score: number;
  tier: Tier;
  size?: number;
}) {
  const pct = Math.min(1, Math.max(0, score / 1000));
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const color = TIER_COLOR[tier];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gaugeFill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.85} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={8}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#gaugeFill)"
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1), stroke 400ms ease",
            filter: `drop-shadow(0 0 10px ${color})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-mono text-5xl font-medium tracking-tight">
            <CountUp value={score} />
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
            Score · /1000
          </div>
          <div
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ borderColor: color, color }}
          >
            <span className="size-1.5 rounded-full" style={{ background: color }} />
            Tier {tier}
          </div>
        </div>
      </div>
    </div>
  );
}
