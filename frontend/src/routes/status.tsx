import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Layout } from "@/components/Layout";
import {
  incidents,
  lastUpdatedMinutesAgo,
  networkInfo,
  overallStatus,
  protocolStats,
  systemComponents,
  tierDistribution,
  tvlHistory,
  type ComponentStatus,
} from "@/lib/mockStatusData";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "CrediFi Status — Protocol & System Health" },
      {
        name: "description",
        content:
          "Live protocol stats, system health, and network info for the CrediFi lending protocol on HashKey Chain.",
      },
      { property: "og:title", content: "CrediFi Status" },
      {
        property: "og:description",
        content:
          "Transparency dashboard: TVL, active loans, oracle health, and HSK Chain network info.",
      },
    ],
  }),
  component: StatusPage,
});

const STATUS_META: Record<
  ComponentStatus,
  { label: string; color: string; glow: string }
> = {
  operational: {
    label: "Operational",
    color: "var(--primary)",
    glow: "0 0 8px var(--primary)",
  },
  degraded: {
    label: "Degraded",
    color: "var(--warning)",
    glow: "0 0 8px var(--warning)",
  },
  outage: {
    label: "Outage",
    color: "var(--destructive)",
    glow: "0 0 8px var(--destructive)",
  },
};

const OVERALL_COPY: Record<ComponentStatus, string> = {
  operational: "All Systems Operational",
  degraded: "Partial Degradation",
  outage: "Service Outage",
};

function StatusPage() {
  const meta = STATUS_META[overallStatus];
  return (
    <Layout>
      <article className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Public Status
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mt-2">
              CrediFi Status
            </h1>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Updated {lastUpdatedMinutesAgo} minute
            {lastUpdatedMinutesAgo === 1 ? "" : "s"} ago
          </div>
        </header>

        {/* OVERALL BANNER */}
        <div
          className="surface-card p-5 sm:p-6 flex items-center gap-4 mb-12"
          style={{
            borderColor: `color-mix(in oklab, ${meta.color} 40%, var(--border))`,
            background: `color-mix(in oklab, ${meta.color} 6%, var(--card))`,
          }}
        >
          <span
            className="size-3 rounded-full shrink-0"
            style={{ background: meta.color, boxShadow: meta.glow }}
          />
          <div className="flex-1">
            <div className="font-display text-xl sm:text-2xl font-semibold">
              {OVERALL_COPY[overallStatus]}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              All protocol components reporting healthy.
            </div>
          </div>
          <span
            className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border"
            style={{
              borderColor: `color-mix(in oklab, ${meta.color} 40%, var(--border))`,
              color: meta.color,
            }}
          >
            {meta.label}
          </span>
        </div>

        {/* SECTION A: PROTOCOL STATS */}
        <SectionHead eyebrow="Section A" title="Protocol Stats" />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          {protocolStats.map((s) => (
            <div key={s.label} className="surface-card p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {s.label}
              </div>
              <div
                className={`mt-2 font-mono text-2xl sm:text-3xl font-medium ${
                  s.accent ? "text-primary" : ""
                }`}
              >
                {s.value}
              </div>
              {s.sub && (
                <div className="text-xs text-muted-foreground mt-1">
                  {s.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3 mt-3">
          <div className="surface-card p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  TVL · last 14 days
                </div>
                <div className="font-display text-lg font-medium mt-1">
                  Steady growth
                </div>
              </div>
              <div className="text-xs text-primary font-mono">+16.9%</div>
            </div>
            <div className="h-56 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={tvlHistory}
                  margin={{ left: -16, right: 8, top: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="tvlFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--primary)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    interval={1}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
                    width={56}
                  />
                  <Tooltip
                    cursor={{
                      stroke: "var(--primary)",
                      strokeOpacity: 0.4,
                      strokeWidth: 1,
                    }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [
                      `$${value.toLocaleString()}`,
                      "TVL",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="tvl"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#tvlFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Borrower Tier Distribution
            </div>
            <div className="font-display text-lg font-medium mt-1">
              Active loans, by tier
            </div>
            <div className="mt-5 space-y-4">
              {tierDistribution.map((t) => (
                <div key={t.tier}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span
                      className="font-display font-semibold"
                      style={{ color: `var(--tier-${t.tier.toLowerCase()})` }}
                    >
                      Tier {t.tier}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${t.pct}%`,
                        background: `var(--tier-${t.tier.toLowerCase()})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION B: SYSTEM HEALTH */}
        <div className="mt-14">
          <SectionHead eyebrow="Section B" title="System Health" />
        </div>

        <div className="surface-card mt-6 overflow-hidden">
          {systemComponents.map((c, i) => {
            const m = STATUS_META[c.status];
            return (
              <div
                key={c.name}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 ${
                  i !== systemComponents.length - 1
                    ? "border-b border-border/60"
                    : ""
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: m.color, boxShadow: m.glow }}
                />
                <div className="min-w-0">
                  <div className="font-display font-medium text-sm flex items-center gap-2">
                    {c.name}
                    {c.href && (
                      <a
                        href={c.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-primary transition"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {c.detail}
                  </div>
                </div>
                <span
                  className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border"
                  style={{
                    borderColor: `color-mix(in oklab, ${m.color} 40%, var(--border))`,
                    color: m.color,
                  }}
                >
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="surface-card mt-3 p-5 sm:p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Incident History · last 30 days
          </div>
          {incidents.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" />
              No incidents reported in the last 30 days.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {incidents.map((inc) => (
                <li
                  key={inc.date + inc.title}
                  className="border-l-2 border-warning pl-4"
                >
                  <div className="font-mono text-xs text-muted-foreground">
                    {inc.date} · resolved in {inc.resolutionMinutes}m
                  </div>
                  <div className="font-display text-sm font-medium mt-1">
                    {inc.title}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {inc.summary}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* SECTION C: NETWORK INFO */}
        <div className="mt-14">
          <SectionHead eyebrow="Section C" title="Network Info" />
        </div>

        <div className="surface-card mt-6 p-5 sm:p-6 grid sm:grid-cols-3 gap-5">
          <InfoCell label="Network" value={networkInfo.chainName} />
          <InfoCell label="Chain ID" value={String(networkInfo.chainId)} mono />
          <InfoCell label="Native Token" value={networkInfo.nativeToken} mono />
        </div>

        <div className="surface-card mt-3 divide-y divide-border/60">
          <AddressRow
            label="CrediFiOracle"
            address={networkInfo.oracleAddress}
            explorer={networkInfo.explorerBase}
          />
          <AddressRow
            label="CrediFiPool"
            address={networkInfo.poolAddress}
            explorer={networkInfo.explorerBase}
          />
        </div>
      </article>
    </Layout>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
        {eyebrow}
      </div>
      <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-1.5">
        {title}
      </h2>
    </div>
  );
}

function InfoCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1.5 text-base ${mono ? "font-mono" : "font-display font-medium"}`}
      >
        {value}
      </div>
    </div>
  );
}

function AddressRow({
  label,
  address,
  explorer,
}: {
  label: string;
  address: string;
  explorer: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="px-5 py-4 grid grid-cols-[1fr_auto] gap-3 items-center">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 font-mono text-xs sm:text-sm truncate">
          {address}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 h-8 text-xs hover:border-primary/40 hover:text-primary transition"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={`${explorer}/address/${address}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 h-8 text-xs hover:border-primary/40 hover:text-primary transition"
        >
          <ExternalLink className="size-3.5" />
          Explorer
        </a>
      </div>
    </div>
  );
}
