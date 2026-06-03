import { notFound } from "next/navigation";

import { CandidateShell } from "@/components/shell/CandidateShell";
import { CandidateDashboardPage } from "@/features/candidate-dashboard";
import { loadCandidateDashboardForCurrentCandidate } from "@/lib/server/candidate";

export const dynamic = "force-dynamic";

type DashboardRouteProps = {
    searchParams?: Promise<{
        targetRole?: string;
    }>;
};

export default async function DashboardRoute({ searchParams }: DashboardRouteProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const dashboard = await loadCandidateDashboardForCurrentCandidate({
        targetRole: resolvedSearchParams.targetRole,
    });
    if (!dashboard) {
        notFound();
    }

    return (
        <CandidateShell>
            <CandidateDashboardPage dashboard={dashboard} />
        </CandidateShell>
    );
}
