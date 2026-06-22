import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wallet,
  Database,
  Sparkles,
  ArrowDownToLine,
  ShieldCheck,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { WalletButton } from "@/components/WalletButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TIER_RATIOS, type Tier } from "@/lib/mockData";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How CrediFi Works — On-chain Credit Scoring" },
      {
        name: "description",
        content:
          "A complete walk-through of CrediFi's credit oracle, tier system, and pooled lending on HashKey Chain.",
      },
      { property: "og:title", content: "How CrediFi Works" },
      {
        property: "og:description",
        content:
          "Turn on-chain history into a credit score and unlock lower-collateral loans on HashKey Chain.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    body: "Link any HashKey Chain address. CrediFi reads only public on-chain data — we never see private keys, seed phrases, or off-chain accounts.",
  },
  {
    icon: Database,
    title: "We analyze your on-chain history",
    body: "Our model evaluates wallet age, transaction activity, repayment history, and asset diversity — all from HSK Chain only. Scoring is computed off-chain for speed, then signed and committed on-chain through the CrediFi Oracle. No personal data is ever collected.",
  },
  {
    icon: Sparkles,
    title: "You get a credit score and tier",
    body: "Scores range 0–1000 and map to tiers A through D. Your tier determines how much collateral you need to borrow — Tier A wallets borrow at 50%, the lowest on HSK Chain.",
  },
  {
    icon: ArrowDownToLine,
    title: "Borrow at your tier's ratio — repay to climb",
    body: "Repaying on time improves your score for the next loan. Missed or liquidated loans pull it back down. The system is designed to reward consistency, not raw volume.",
  },
];

const TIER_ROWS: {
  tier: Tier;
  range: string;
  label: string;
  desc: string;
  color: string;
}[] = [
  {
    tier: "A",
    range: "800 – 1000",
    label: "Prime",
    color: "var(--tier-a)",
    desc: "Multi-year wallets with steady activity, repaid loans, and diversified assets.",
  },
  {
    tier: "B",
    range: "650 – 799",
    label: "Strong",
    color: "var(--tier-b)",
    desc: "Active wallets with a positive history and modest diversification.",
  },
  {
    tier: "C",
    range: "450 – 649",
    label: "Standard",
    color: "var(--tier-c)",
    desc: "Newer or lightly active wallets with limited repayment history.",
  },
  {
    tier: "D",
    range: "0 – 449",
    label: "New",
    color: "var(--tier-d)",
    desc: "Fresh wallets, or wallets with negative repayment events.",
  },
];

const FAQS = [
  {
    q: "Is any personal data collected?",
    a: "No. CrediFi computes scores entirely from public HSK Chain transaction history. We never ask for KYC, email, or off-chain financial records.",
  },
  {
    q: "What happens if I don't repay a loan?",
    a: "Your collateral can be liquidated, and the missed loan is recorded on-chain — pulling your score and tier down for future borrowing.",
  },
  {
    q: "Is CrediFi audited?",
    a: "Not yet. This is an experimental hackathon build deployed on testnet. Do not use with funds you cannot afford to lose.",
  },
  {
    q: "What chain does CrediFi run on?",
    a: "HashKey Chain (HSK Chain), an EVM-compatible, compliance-first L2 built for regulated DeFi.",
  },
  {
    q: "Can I lose my collateral?",
    a: "Yes — if the value of your collateral falls below the required threshold or you fail to repay, the protocol can liquidate it according to the smart contract rules.",
  },
  {
    q: "Where does the lender's yield come from?",
    a: "Yield is paid by borrowers through interest on outstanding loans. Lenders share that interest pro-rata based on their pool share.",
  },
];

function HowItWorksPage() {
  return (
    <Layout>
      <article className="relative">
        <div className="absolute inset-0 dot-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />

        {/* HEADER */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            How it works
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight mt-3 leading-[1.05]">
            On-chain history,<br />
            <span className="text-primary">priced fairly.</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-5 max-w-2xl leading-relaxed">
            CrediFi turns your HashKey Chain activity into a credit score, and
            uses that score to lower the collateral you need to borrow. Here's
            exactly how it works, end-to-end.
          </p>
        </section>

        {/* PROBLEM */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-2 gap-6">
          <div className="surface-card p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              The Problem
            </div>
            <h2 className="font-display text-2xl font-semibold mt-2">
              DeFi treats every wallet the same.
            </h2>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              Today, on-chain lending requires you to lock up more value than you
              borrow — often 150% or more. That makes credit unusable for anyone
              without spare capital sitting idle, even wallets with a perfect
              repayment record.
            </p>
          </div>
          <div className="surface-card p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              The Solution
            </div>
            <h2 className="font-display text-2xl font-semibold mt-2">
              Reputation as collateral.
            </h2>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              CrediFi reads your public on-chain history and produces a 0–1000
              credit score. Higher scores unlock lower collateral ratios — down
              to 50% for Tier A wallets. Your behavior on-chain becomes the
              capital you didn't have.
            </p>
          </div>
        </section>

        {/* FLOW */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            The Flow
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-2 tracking-tight">
            Four steps, no paperwork.
          </h2>

          <ol className="mt-10 space-y-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.title}
                  className="surface-card p-6 sm:p-7 grid sm:grid-cols-[auto_1fr] gap-5 sm:gap-7 relative overflow-hidden"
                >
                  <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:w-32">
                    <div className="font-mono text-5xl font-semibold text-primary leading-none">
                      0{i + 1}
                    </div>
                    <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 border border-primary/30 text-primary">
                      <Icon className="size-5" strokeWidth={2} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold">
                      {s.title}
                    </h3>
                    <p className="text-muted-foreground text-[15px] mt-2 leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* TIERS */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            Tier breakdown
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-2 tracking-tight">
            Where you land, what you pay.
          </h2>

          <div className="mt-8 surface-card overflow-hidden">
            <div className="hidden sm:grid grid-cols-[80px_140px_120px_1fr] gap-4 px-5 py-3 border-b border-border/60 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <div>Tier</div>
              <div>Score</div>
              <div>Collateral</div>
              <div>Wallet profile</div>
            </div>
            {TIER_ROWS.map((t) => (
              <div
                key={t.tier}
                className="grid grid-cols-2 sm:grid-cols-[80px_140px_120px_1fr] gap-4 px-5 py-5 border-b border-border/60 last:border-b-0 items-center"
              >
                <div
                  className="font-display text-3xl font-semibold"
                  style={{ color: t.color }}
                >
                  {t.tier}
                  <span className="ml-2 text-[11px] uppercase tracking-wider text-muted-foreground font-sans font-normal">
                    {t.label}
                  </span>
                </div>
                <div className="font-mono text-sm">{t.range}</div>
                <div className="font-mono text-sm">
                  {Math.round(TIER_RATIOS[t.tier] * 100)}%
                </div>
                <div className="col-span-2 sm:col-span-1 text-sm text-muted-foreground">
                  {t.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FOR LENDERS */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="surface-card p-6 sm:p-8 grid sm:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/10 border border-primary/30 text-primary">
              <Layers className="size-5" strokeWidth={2} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                For Lenders
              </div>
              <h2 className="font-display text-2xl font-semibold mt-2">
                One pool, shared yield.
              </h2>
              <p className="text-muted-foreground text-[15px] mt-3 leading-relaxed">
                Lenders deposit into a single shared pool — not peer-to-peer.
                Borrower interest is distributed pro-rata to depositors as the
                pool earns. Principal plus accrued yield can be withdrawn at any
                time, subject to available liquidity.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <Stat
                  icon={<ShieldCheck className="size-4 text-primary" />}
                  label="Single pool"
                />
                <Stat
                  icon={<TrendingUp className="size-4 text-primary" />}
                  label="Pro-rata yield"
                />
                <Stat
                  icon={<ArrowDownToLine className="size-4 text-primary" />}
                  label="Anytime withdraw"
                />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            FAQ
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-2 tracking-tight">
            Common questions.
          </h2>
          <div className="mt-8 surface-card px-5 sm:px-6">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`faq-${i}`}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <AccordionTrigger className="text-left font-display text-base font-medium hover:no-underline py-5">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-5">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <div className="relative overflow-hidden surface-card p-8 sm:p-12 text-center">
            <div className="absolute inset-0 dot-grid opacity-40" />
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
                Ready to check your score?
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto">
                Connect a wallet to see your tier and the rate you'd borrow at.
              </p>
              <div className="mt-6 inline-flex items-center gap-3">
                <WalletButton size="lg" />
                <Link
                  to="/dashboard"
                  className="text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Preview dashboard →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </article>
    </Layout>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2">
      {icon}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
