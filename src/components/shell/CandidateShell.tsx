import type { ReactNode } from "react";

import { CandidateDisclosureFooter } from "@/components/shell/CandidateDisclosureFooter";
import { CandidateSidebar } from "@/components/shell/CandidateSidebar";
import { CandidateMobileDock } from "@/components/shell/CandidateMobileDock";

export function CandidateShell({ children }: { children: ReactNode }) {
  return (
    <div className="candidate-design-system min-h-screen bg-[rgb(var(--candidate-background))]">
      <div className="flex min-h-screen">
        <CandidateSidebar />
        <main className="flex-1 w-full max-w-full overflow-hidden px-4 pb-24 pt-6 md:p-8 md:pb-8 md:pt-8">
          {children}
          <CandidateDisclosureFooter />
        </main>
      </div>
      <CandidateMobileDock />
    </div>
  );
}
