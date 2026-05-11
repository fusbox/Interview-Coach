import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type ActionButtonProps = {
  href?: string;
  children: ReactNode;
  secondary?: boolean;
  size?: "default" | "large";
  className?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
};

export function ActionButton({
  href,
  children,
  secondary = false,
  size = "default",
  className,
  type = "button",
  disabled = false,
  onClick
}: ActionButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition-[transform,background-color,opacity] duration-200",
    size === "large" ? "min-h-12 px-6 py-3.5 text-sm" : "px-5 py-3 text-sm",
    secondary
      ? "border border-[rgb(var(--candidate-border))] bg-[rgb(var(--candidate-surface))] text-[rgb(var(--candidate-foreground))] hover:bg-[rgb(var(--candidate-surface-alt))]"
      : "bg-[rgb(var(--candidate-primary))] text-white shadow-[0_10px_22px_rgba(12,97,233,0.22)] hover:bg-[rgb(9,81,199)]",
    disabled ? "cursor-not-allowed opacity-50" : "hover:-translate-y-0.5",
    className
  );

  if (href) {
    return (
      <Link className={classes} href={disabled ? "#" : href} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
