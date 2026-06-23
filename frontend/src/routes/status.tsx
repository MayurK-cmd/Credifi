import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { getStatus } from "@/lib/api";
import type { ComponentStatus, StatusPayload } from "@/lib/status-types";

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
  const q = useQuery({
    queryKey: ["status"],
    queryFn: () => getStatus(),
    refetchInterval: 30_000,
  });

  // Derived "X minutes ago" string from the query's own update time so the
  // label refreshes with each refetch — backend hardcodes 0 today.
  const updatedAgo = useMemo(() => {
    if (!q.dataUpdatedAt) return null;
    const minutes = Math.max(0, Math.floor((Date.now() - q.dataUpdatedAt) / 60_000));
    return minutes;
  }, [q.dataUpdatedAt]);

  if (q.isLoading) {
    return (
      <Layout>
        <article className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
          <div className="font-mono text-xs text-muted-foreground">
            Loading protocol status…
          </div>
        </article>
      </Layout>
    );
  }

  if (q.isError) {
    return (
      <Layout>
        <article className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
          <div className="surface-card p-5 border border-destructive/40">
            <div className="font-display text-lg font-semibold text-destructive">
              Could not reach the status endpoint
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {q.error instanceof Error ? q.error.message : String(q.error)}
            </div>
            <button
              onClick={() => void q.refetch()}
              className="mt-3 inline-flex items-center rounded-md border border-border bg-card/40 px-2.5 h-8 text-xs hover:border-primary/40 hover:text-primary transition"
            >
              Retry
            </button>
          </div>
        </article>
      </Layout>
    );
  }

  if (!q.data) {
    // Defensive: queryFn resolves to a defined payload. If not, treat as error.
    return (
      <Layout>
        <article className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
          <div className="surface-card p-5 border border-destructive/40">
            <div className="font-display text-lg font-semibold text-destructive">
              Status payload missing
            </div>
            <button
              onClick={() => void q.refetch()}
              className="mt-3 inline-flex items-center rounded-md border border-border bg-card/40 px-2.5 h-8 text-xs hover:border-primary/40 hover:text-primary transition"
            >
              Retry
            </button>
          </div>
        </article>
      </Layout>
    );
  }

  return <StatusBody data={q.data} updatedAgo={updatedAgo} />;
}

function StatusBody({
  data,
  updatedAgo,
}: {
  data: StatusPayload;
  updatedAgo: number | null;
}) {
  const meta = STATUS_META[data.overallStatus];
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
          {updatedAgo !== null && (
            <div className="text-xs text-muted-foreground font-mono">
              Updated {updatedAgo} minute{updatedAgo === 1 ? "" : "s"} ago
            </div>
          )}
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
              {OVERALL_COPY[data.overallStatus]}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {data.overallStatus === "operational"
                ? "All protocol components reporting healthy."
                : data.overallStatus === "degraded"
                  ? "Some protocol components are degraded. Operations may be slow or partial."
                  : "One or more critical services are down. Borrowing is paused."}
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
          {data.protocolStats.map((s) => (
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
                  TVL · last 14 samples
                </div>
                <div className="font-display text-lg font-medium mt-1">
                  {data.tvlHistory.length >= 2
                    ? "Trend"
                    : "Sampling…"}
                </div>
              </div>
              {data.tvlHistory.length >= 2 && (
                <TvlDelta points={data.tvlHistory} />
              )}
            </div>
            <div className="h-56 mt-4">
              {data.tvlHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No samples yet — the indexer writes one every few minutes.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.tvlHistory}
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
                      tickFormatter={(v) => formatHskAxis(Number(v))}
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
                      formatter={(value) => {
                        const n = typeof value === "number" ? value : Number(value ?? 0);
                        return [`${n.toLocaleString()} HSK`, "TVL"];
                      }}
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
              )}
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
              {data.tierDistribution.map((t) => (
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
          {data.systemComponents.map((c, i) => {
            const m = STATUS_META[c.status];
            return (
              <div
                key={c.name}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 ${
                  i !== data.systemComponents.length - 1
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
          {data.incidents.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" />
              No incidents reported in the last 30 days.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.incidents.map((inc) => (
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
          <InfoCell label="Network" value={data.networkInfo.chainName} />
          <InfoCell label="Chain ID" value={String(data.networkInfo.chainId)} mono />
          <InfoCell label="Native Token" value={data.networkInfo.nativeToken} mono />
        </div>

        <div className="surface-card mt-3 divide-y divide-border/60">
          <AddressRow
            label="CrediFiOracle"
            address={data.networkInfo.oracleAddress}
            explorer={data.networkInfo.explorerBase}
          />
          <AddressRow
            label="CrediFiPool"
            address={data.networkInfo.poolAddress}
            explorer={data.networkInfo.explorerBase}
          />
        </div>
      </article>
    </Layout>
  );
}

function TvlDelta({ points }: { points: { tvl: number }[] }) {
  const newest = points[points.length - 1]?.tvl ?? 0;
  const oldest = points[0]?.tvl ?? 0;
  if (oldest <= 0) {
    return <div className="text-xs text-muted-foreground font-mono">—</div>;
  }
  const pct = ((newest - oldest) / oldest) * 100;
  const sign = pct >= 0 ? "+" : "";
  return <div className="text-xs text-primary font-mono">{sign}{pct.toFixed(1)}%</div>;
}

function formatHskAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
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
