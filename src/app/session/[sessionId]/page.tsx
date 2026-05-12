import { notFound } from "next/navigation";

import { CandidateSessionPage } from "@/features/candidate-session";
import { loadCandidateSessionForCurrentCandidate } from "@/lib/server/candidate";

type CandidateSessionRouteProps = {
    params: Promise<{
        sessionId: string;
    }>;
};

export const dynamic = "force-dynamic";

export default async function CandidateSessionRoute({ params }: CandidateSessionRouteProps) {
    const { sessionId } = await params;
    const loadedSession = await loadCandidateSessionForCurrentCandidate(sessionId);

    if (!loadedSession) {
        notFound();
    }

    return <CandidateSessionPage loadedSession={loadedSession} />;
}
