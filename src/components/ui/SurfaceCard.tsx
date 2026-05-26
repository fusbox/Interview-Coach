import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SurfaceCardProps = {
  title?: string;
  eyebrow?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
};

export function SurfaceCard({
  title,
  eyebrow,
  description,
  className,
  children
}: SurfaceCardProps) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-[rgb(var(--candidate-border)/0.8)] bg-[rgb(var(--candidate-surface)/0.95)] p-6 shadow-[var(--candidate-shadow-card)]",
        className
      )}
    >
      {(eyebrow || title || description) && (
        <header className="mb-5 space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[rgb(var(--candidate-muted))]">{eyebrow}</p>
          ) : null}
          {title ? <h2 className="text-xl font-semibold text-[rgb(var(--candidate-foreground))]">{title}</h2> : null}
          {description ? <p className="max-w-2xl text-sm leading-7 text-[rgb(var(--candidate-muted))]">{description}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}
