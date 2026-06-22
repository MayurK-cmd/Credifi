import type { ScoreFactor } from "@/lib/mockData";

export function ScoreBreakdown({ factors }: { factors: ScoreFactor[] }) {
  return (
    <div className="space-y-4">
      {factors.map((f) => (
        <div key={f.label}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground uppercase tracking-wider">{f.label}</span>
            <span className="font-mono font-medium text-foreground">{f.value}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
              style={{ width: `${f.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
