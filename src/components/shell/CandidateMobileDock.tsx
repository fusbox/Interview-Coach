"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Briefcase, LayoutDashboard, Sparkles } from "lucide-react";

import { cn } from "@/lib/cn";
import { mobileCoachLinks } from "@/lib/navigation";

const iconMap = {
  "Back to RangamWorks": ArrowLeft,
  "Interview Coach": Sparkles,
  Practice: Sparkles,
  Dashboard: LayoutDashboard
};

export function CandidateMobileDock() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 rounded-[1.75rem] border border-[rgb(var(--candidate-border)/0.8)] bg-[rgb(var(--candidate-surface)/0.96)] p-2 shadow-[0_22px_60px_rgba(10,30,53,0.12)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-4 gap-2">
        {mobileCoachLinks.map((item) => {
          const Icon = iconMap[item.label as keyof typeof iconMap] ?? Briefcase;
          const isActive = !item.external && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));

          if (item.external) {
            return (
              <li key={item.label}>
                <a
                  className="flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-medium text-[rgb(var(--candidate-muted))] transition-colors hover:bg-[rgb(var(--candidate-primary-soft))]"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label.replace("Back to ", "")}</span>
                </a>
              </li>
            );
          }

          return (
            <li key={item.label}>
              <Link
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-[rgb(var(--candidate-primary))] text-white"
                    : "text-[rgb(var(--candidate-muted))] hover:bg-[rgb(var(--candidate-primary-soft))]"
                )}
                href={item.href}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
