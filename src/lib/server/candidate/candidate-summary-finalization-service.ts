import { updateSessionCommand } from "@/lib/server/application/session/update-session";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";

import { withCandidateMutationBoundary } from "./candidate-mutation-boundary";
import { findCandidatePracticeDraftBySessionId } from "./candidate-practice-draft-repository";

type CandidateSummaryFinalizationInput = {
    candidateProfileId: string;
    sessionId: string;
};

type CandidateSummaryFinalizationResult =
    | { ok: true; generated: boolean }
    | { ok: false; error: string };

export async function finalizeCandidateOwnedSummary(
    input: CandidateSummaryFinalizationInput,
): Promise<CandidateSummaryFinalizationResult> {
    return withCandidateMutationBoundary({
        candidateProfileId: input.candidateProfileId,
        operation: "session_summary_finalize",
        subjectId: input.sessionId,
        mutate: async () => {
            const ownership = await findCandidatePracticeDraftBySessionId(input);
            if (!ownership) {
                return { ok: false, error: "Candidate session was not found." };
            }

            const repository = await createSessionRepository();
            const session = await repository.get(input.sessionId);
            if (!session) {
                return { ok: false, error: "Candidate session was not found." };
            }
            if (session.status !== "COMPLETED") {
                return { ok: false, error: "Candidate summary is not ready yet." };
            }
            if (session.summaryNarrative) {
                return { ok: true, generated: false };
            }

            await updateSessionCommand(input.sessionId, { status: "COMPLETED" });
            return { ok: true, generated: true };
        },
    });
}
