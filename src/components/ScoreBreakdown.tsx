import type { ScoreFactor } from "@/lib/mockData";

export function ScoreBreakdown({ factors }: { factors: ScoreFactor[] }) {
  return (
    <div className="space-y-4">
      {factors.map((f) => (
        <div key={f.label}>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">{f.label}</span>
            <span className="tabular-nums font-medium">{f.value}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${f.value}%`, boxShadow: "0 0 8px var(--primary)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
