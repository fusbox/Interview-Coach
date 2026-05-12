import { notFound } from "next/navigation";

import { CandidateDashboardPage } from "@/features/candidate-dashboard";
import { loadCandidateDashboardForCurrentCandidate } from "@/lib/server/candidate";

export const dynamic = "force-dynamic";

export default async function DashboardRoute() {
    const dashboard = await loadCandidateDashboardForCurrentCandidate();
    if (!dashboard) {
        notFound();
    }

    return <CandidateDashboardPage dashboard={dashboard} />;
}
