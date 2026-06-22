import type { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface-card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            {title && (
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="font-display text-base font-medium text-foreground mt-1.5">
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
