import { TIER_RATIOS, type Tier } from "@/lib/mockData";

const TIER_META: Record<Tier, { range: string; label: string; color: string }> = {
  A: { range: "800 – 1000", label: "Prime", color: "var(--tier-a)" },
  B: { range: "650 – 799", label: "Strong", color: "var(--tier-b)" },
  C: { range: "450 – 649", label: "Standard", color: "var(--tier-c)" },
  D: { range: "0 – 449", label: "New", color: "var(--tier-d)" },
};

export function TierComparisonRow({ activeTier }: { activeTier?: Tier }) {
  const tiers: Tier[] = ["A", "B", "C", "D"];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tiers.map((t) => {
        const meta = TIER_META[t];
        const active = t === activeTier;
        return (
          <div
            key={t}
            className={`relative rounded-lg border p-4 transition-colors ${
              active
                ? "border-primary/60 bg-primary/[0.06]"
                : "border-border bg-card/40 hover:border-border/80"
            }`}
          >
            {active && (
              <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wider text-primary">
                You
              </span>
            )}
            <div className="flex items-baseline gap-2">
              <span
                className="font-display text-3xl font-semibold"
                style={{ color: meta.color }}
              >
                {t}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {meta.label}
              </span>
            </div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              {meta.range}
            </div>
            <div className="mt-3 pt-3 border-t border-border/60">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Collateral
              </div>
              <div className="font-mono text-lg font-medium mt-0.5">
                {Math.round(TIER_RATIOS[t] * 100)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
