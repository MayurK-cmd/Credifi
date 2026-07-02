import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Shield, Zap, Activity } from "lucide-react";
import { Layout } from "@/components/Layout";
import { WalletButton } from "@/components/WalletButton";
import { HowItWorksSteps } from "@/components/HowItWorksSteps";
import { TierComparisonRow } from "@/components/TierComparisonRow";
import { config } from "@/lib/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CrediFi — On-chain Credit Scores for HashKey Chain" },
      { name: "description", content: "AI credit scores unlock lower-collateral lending on HashKey Chain. Borrow with as little as 50% collateral." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <Layout>
      <Hero />
      <HowItWorks />
      <StatsStrip />
      <Tiers />
      <CallToAction />
    </Layout>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/[0.06] blur-3xl -z-10" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-28">
        <div className="max-w-3xl fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="size-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px var(--primary)" }} />
            <span className="font-mono uppercase tracking-wider text-[10px]">Live</span>
            <span className="opacity-50">·</span>
            {config.chainId === 133 ? "HashKey Chain Testnet" : "HashKey Chain Mainnet"}
          </div>
          <h1 className="font-display text-5xl sm:text-7xl font-semibold tracking-tight leading-[1.02]">
            Your on-chain history<br />
            <span className="text-primary">is your credit score.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            CrediFi turns wallet activity into an AI-derived credit score so you can
            borrow on HashKey Chain with as little as <span className="text-foreground font-medium">50% collateral</span>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 items-center">
            <WalletButton size="lg" />
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card/40 px-5 h-11 text-sm font-medium hover:bg-card hover:border-border/80 transition"
            >
              How it works <ArrowRight className="size-3.5" />
            </a>
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition ml-1"
            >
              Preview dashboard →
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Shield className="size-3.5 text-primary" /> Read-only, never your keys</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="size-3.5 text-primary" /> Sub-second scoring</span>
            <span className="inline-flex items-center gap-1.5"><Activity className="size-3.5 text-primary" /> Compliance-first chain</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <SectionHeader eyebrow="How it works" title="Three steps to better terms." />
        <Link
          to="/how-it-works"
          className="text-sm text-muted-foreground hover:text-primary transition inline-flex items-center gap-1"
        >
          Learn more <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-10">
        <HowItWorksSteps />
      </div>
    </section>
  );
}

const STATS = [
  { label: "Total Supplied", value: "$1.28M", mono: true },
  { label: "Active Loans", value: "412", mono: true },
  { label: "Avg. Credit Score", value: "684", mono: true },
  { label: "Supply APY", value: "6.42%", mono: true, accent: true },
];

function StatsStrip() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 sm:pb-20">
      <div className="surface-card divide-y sm:divide-y-0 sm:divide-x divide-border/60 grid grid-cols-2 sm:grid-cols-4 overflow-hidden">
        {STATS.map((s) => (
          <div key={s.label} className="p-5 sm:p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {s.label}
            </div>
            <div
              className={`mt-2 ${s.mono ? "font-mono" : "font-display"} text-2xl sm:text-3xl font-medium ${
                s.accent ? "text-primary" : ""
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tiers() {
  return (
    <section id="tiers" className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 sm:pb-20">
      <SectionHeader
        eyebrow="Credit Tiers"
        title="Higher score, lower collateral."
        sub="Your tier determines how much you have to lock up to borrow."
      />
      <div className="mt-8">
        <TierComparisonRow />
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
      <div className="relative overflow-hidden surface-card p-8 sm:p-12">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
              Borrow on what you've earned.
            </h2>
            <p className="text-muted-foreground mt-3">
              Your on-chain reputation, finally working for you. Connect a wallet to see your score.
            </p>
          </div>
          <WalletButton size="lg" />
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
        {eyebrow}
      </div>
      <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-2">
        {title}
      </h2>
      {sub && <p className="text-muted-foreground mt-3">{sub}</p>}
    </div>
  );
}
