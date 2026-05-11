"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft, Briefcase, FileText, LayoutDashboard, LogOut, Sparkles } from "lucide-react";

import { cn } from "@/lib/cn";
import { coachLinks, suiteLinks } from "@/lib/navigation";

const iconMap = {
  "Back to RangamWorks": ArrowLeft,
  "Resume Builder": FileText,
  "Interview Coach": Sparkles,
  "Job Auto-Applicant": Briefcase,
  Practice: Sparkles,
  Dashboard: LayoutDashboard,
  Summary: FileText
};

function SidebarLink({
  label,
  href,
  external,
  nested = false,
  onNavigate
}: {
  label: string;
  href: string;
  external?: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = !external && (pathname === href || (href !== "/" && pathname.startsWith(href)));
  const Icon = iconMap[label as keyof typeof iconMap] ?? Sparkles;

  const classes = cn(
    "flex items-center gap-3 rounded-xl p-2.5 font-medium transition-all duration-200 group",
    nested ? "ml-5" : "",
    isActive
      ? "bg-[rgb(var(--candidate-primary))] text-white shadow-[0_10px_22px_rgba(12,97,233,0.22)]"
      : "text-[rgb(var(--candidate-muted))] hover:bg-[rgb(var(--candidate-surface-alt))] hover:text-[rgb(var(--candidate-foreground))]"
  );

  if (external) {
    return (
      <a className={classes} href={href} target="_blank" rel="noreferrer">
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{label}</span>
      </a>
    );
  }

  return (
    <Link className={classes} href={href} onClick={onNavigate}>
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function CandidateSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col border-r border-[rgb(var(--candidate-border)/0.8)] bg-[rgb(var(--candidate-surface))] px-6 py-6 lg:flex">
      <div className="pb-6">
        <div className="px-2">
          <Image
            src="/rangam-logo.webp"
            alt="RangamWorks"
            width={152}
            height={32}
            className="h-8 w-auto"
            priority
          />
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto py-4">
        {suiteLinks.map((item) => (
          <div key={item.label}>
            <SidebarLink {...item} />

            {item.label === "Interview Coach" && (
              <div className="mt-1 space-y-1">
                {coachLinks.map((coachLink) => (
                  <SidebarLink key={coachLink.label} {...coachLink} nested />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-[rgb(var(--candidate-border)/0.8)] pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--candidate-muted))]">
              Signed In As
            </p>
            <p className="truncate text-sm font-medium text-[rgb(var(--candidate-foreground))]" title="candidate@rangamworks.com">
              candidate@rangamworks.com
            </p>
          </div>

          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            className="rounded-xl p-2 text-[rgb(var(--candidate-muted))] transition-colors hover:bg-[rgb(var(--candidate-surface-alt))] hover:text-[rgb(var(--candidate-foreground))]"
            onClick={() => undefined}
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
