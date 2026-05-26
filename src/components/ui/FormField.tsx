import type { HTMLAttributes, LabelHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function FieldGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-3", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "ml-1 text-[0.625rem] font-bold uppercase tracking-wider text-[rgb(var(--candidate-muted))]",
        className
      )}
      {...props}
    />
  );
}

export function FieldHint({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("ml-1 text-sm leading-7 text-[rgb(var(--candidate-muted))]", className)} {...props} />
  );
}

export const textFieldClassName = cn(
  "h-12 w-full rounded-xl border border-[rgb(var(--candidate-border))] bg-[rgb(var(--candidate-surface-subtle))] px-4 py-2",
  "text-sm text-[rgb(var(--candidate-foreground))] shadow-[var(--candidate-shadow-soft)]",
  "placeholder:text-[rgb(var(--candidate-placeholder)/0.72)]",
  "transition-all duration-200",
  "focus:border-[rgb(var(--candidate-primary))]",
  "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--candidate-primary))]/20"
);

export const textareaFieldClassName = cn(
  "min-h-[11rem] w-full resize-none rounded-xl border border-[rgb(var(--candidate-border))]",
  "bg-[rgb(var(--candidate-surface-subtle))] px-4 py-3 text-sm leading-relaxed text-[rgb(var(--candidate-foreground))]",
  "shadow-[var(--candidate-shadow-soft)] placeholder:text-[rgb(var(--candidate-placeholder)/0.72)]",
  "transition-all duration-200",
  "focus:border-[rgb(var(--candidate-primary))]",
  "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--candidate-primary))]/20"
);
