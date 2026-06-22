import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from "recharts";

export function ScoreHistoryChart({ data }: { data: { day: string; score: number }[] }) {
  return (
    <div className="h-44 w-full -ml-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="scoreArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={["dataMin - 30", "dataMax + 30"]}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelStyle={{ color: "var(--muted-foreground)", fontFamily: "var(--font-sans)" }}
            cursor={{ stroke: "var(--primary)", strokeOpacity: 0.3, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="none"
            fill="url(#scoreArea)"
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
