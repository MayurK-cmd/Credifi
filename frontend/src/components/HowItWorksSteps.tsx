import { Wallet, Sparkles, ArrowDownToLine } from "lucide-react";

const STEPS = [
  {
    icon: Wallet,
    title: "Connect Wallet",
    body: "Link your HashKey Chain address. We read public on-chain history — never your keys.",
  },
  {
    icon: Sparkles,
    title: "Get Your Credit Score",
    body: "Our model produces a 0–1000 score from wallet age, activity, repayment, and diversity.",
  },
  {
    icon: ArrowDownToLine,
    title: "Borrow With Less",
    body: "Tier A wallets borrow at 50% collateral. Higher score, better terms.",
  },
];

export function HowItWorksSteps() {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        return (
          <div
            key={s.title}
            className="surface-card surface-card-hover p-6 relative overflow-hidden"
          >
            <div className="absolute -top-6 -right-6 text-[120px] font-display font-bold text-foreground/[0.03] select-none leading-none">
              0{i + 1}
            </div>
            <div className="relative">
              <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 border border-primary/30 text-primary mb-4">
                <Icon className="size-5" strokeWidth={2} />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                Step 0{i + 1}
              </div>
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
