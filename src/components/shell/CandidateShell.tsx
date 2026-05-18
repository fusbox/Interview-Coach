import type { ReactNode } from "react";

import { CandidateSidebar } from "@/components/shell/CandidateSidebar";
import { CandidateMobileDock } from "@/components/shell/CandidateMobileDock";

export function CandidateShell({ children }: { children: ReactNode }) {
  return (
    <div className="candidate-design-system min-h-screen bg-[rgb(var(--candidate-background))]">
      <div className="flex min-h-screen">
        <CandidateSidebar />
        <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pb-32 sm:pt-6 md:pb-8 lg:px-10 lg:py-10">{children}</main>
      </div>
      <CandidateMobileDock />
    </div>
  );
}
