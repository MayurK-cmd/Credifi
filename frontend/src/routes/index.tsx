import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { WalletButton } from "@/components/WalletButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CrediFi — AI Credit Scores on HSK Chain" },
      { name: "description", content: "AI credit scores unlock better lending terms on HSK Chain." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <Layout>
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-28 pb-20 sm:pb-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              Live on HSK Chain testnet
            </div>
            <h1 className="font-display text-5xl sm:text-7xl font-semibold tracking-tight leading-[1.02]">
              On-chain credit,<br />
              <span className="text-primary">priced fairly.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              CrediFi turns your wallet activity into an AI-derived credit score so
              you can borrow on HSK Chain with less collateral.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <WalletButton size="lg" />
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-border px-5 h-10 text-sm font-medium hover:bg-accent transition"
              >
                Preview dashboard →
              </Link>
            </div>
          </div>

          <div className="mt-20 grid sm:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="surface-card p-6">
                <div className="text-xs font-mono text-primary mb-3">0{i + 1}</div>
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-20 grid sm:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div key={s.label} className="border border-border/60 rounded-lg p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
                <div className="font-display text-2xl mt-1">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

const STEPS = [
  { title: "Connect wallet", body: "Link your HSK Chain address. We read public on-chain history — never your keys." },
  { title: "Get your score", body: "Our model produces a 0–1000 credit score from wallet age, activity, repayment, and diversity." },
  { title: "Borrow with less", body: "Tier A wallets borrow at 50% collateral. Higher score, better terms." },
];

const STATS = [
  { label: "Total Supplied", value: "$1.28M" },
  { label: "Avg. Credit Score", value: "684" },
  { label: "Active Borrowers", value: "412" },
  { label: "Supply APY", value: "6.42%" },
];
