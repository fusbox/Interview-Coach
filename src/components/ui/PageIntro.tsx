import type { ReactNode } from "react";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[rgb(var(--candidate-muted))]">{eyebrow}</p>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[rgb(var(--candidate-foreground))] sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-8 text-[rgb(var(--candidate-muted))] sm:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
