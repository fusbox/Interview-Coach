import { notFound } from "next/navigation";

import { CandidateSummaryPage } from "@/features/candidate-summary";
import { loadCandidateSummaryForCurrentCandidate } from "@/lib/server/candidate";

export const dynamic = "force-dynamic";

type SummaryRouteProps = {
    params: Promise<{ sessionId: string }>;
};

export default async function SummaryRoute({ params }: SummaryRouteProps) {
    const { sessionId } = await params;
    const summary = await loadCandidateSummaryForCurrentCandidate(sessionId);
    if (!summary) {
        notFound();
    }

    return <CandidateSummaryPage summary={summary} />;
}
