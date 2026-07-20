import { cookies } from "next/headers";

import { candidateSetupStageOptions } from "@/features/candidate-setup-v2/candidate-setup-contract";
import { createInvitedPracticeAccessRepository } from "@/features/recruiter-invites-v2/invited-practice-access-repository";
import { INVITED_PRACTICE_ACCESS_COOKIE } from "@/features/recruiter-invites-v2/invited-practice-access-session";
import {
    createInvitedPracticeEntryProjection,
    resolveInvitedPracticeAccessContext,
    type InvitedPracticeEntryProjection,
} from "@/features/recruiter-invites-v2/invited-practice-entry-service";
import { createInvitedPracticeQueryClientFromEnv } from "@/features/recruiter-invites-v2/invited-practice-postgres-runtime";
import { createInvitedPracticeSessionRuntimeRepository } from "@/features/recruiter-invites-v2/invited-practice-session-runtime-repository";
import { createInvitedPracticeAnswerHistoryRepository } from "@/features/recruiter-invites-v2/invited-practice-answer-history-repository";
import { toInvitedPracticeSharedSessionRecord } from "@/features/recruiter-invites-v2/invited-practice-session-recovery";
import { isCandidateAnswerAnalysisRuntimeAvailable } from "@/features/candidate-session-v2/candidate-answer-analysis-runtime-selection";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";

import { InvitedPracticeEntryRouteExperience } from "./InvitedPracticeEntryRouteExperience";
import { InvitedPracticeCompleted } from "./InvitedPracticeCompleted";
import { InvitedPracticeUnavailable } from "./InvitedPracticeUnavailable";

type InvitedPracticeRouteState = {
    entry: InvitedPracticeEntryProjection;
    initialSession: CandidateProvisionalSessionRecord | null;
};

export async function renderCandidateInvitedEntryRoute(dependencies: {
    resolveState?: () => Promise<InvitedPracticeRouteState | null>;
} = {}) {
    const state = await (dependencies.resolveState ?? resolveDefaultState)();
    if (!state || state.entry.sessionStatus === "abandoned") {
        return <InvitedPracticeUnavailable />;
    }
    const { entry, initialSession } = state;
    if (entry.sessionStatus === "completed") {
        return <InvitedPracticeCompleted targetRole={entry.targetRole} />;
    }
    if (!initialSession) return <InvitedPracticeUnavailable />;
    const stageLabel = candidateSetupStageOptions.find((option) => option.id === entry.interviewStage)?.label
        ?? "Interview practice";
    return (
        <InvitedPracticeEntryRouteExperience
            targetRole={entry.targetRole}
            stageLabel={stageLabel}
            questionCount={entry.questionCount}
            initialsConfirmed={entry.initialsConfirmed}
            candidateFirstName={entry.candidateFirstName}
            initialSession={initialSession}
        />
    );
}

async function resolveDefaultState(): Promise<InvitedPracticeRouteState | null> {
    try {
        const cookieStore = await cookies();
        const rawSessionToken = cookieStore.get(INVITED_PRACTICE_ACCESS_COOKIE)?.value;
        const queryClient = createInvitedPracticeQueryClientFromEnv();
        const accessRepository = createInvitedPracticeAccessRepository(queryClient);
        const context = await resolveInvitedPracticeAccessContext(
            rawSessionToken,
            accessRepository,
        );
        if (!context) return null;
        const entry = createInvitedPracticeEntryProjection(context);
        const sessionRepository = createInvitedPracticeSessionRuntimeRepository(queryClient);
        const session = await sessionRepository.findSession({
            invitedPracticeSessionId: context.sessionId,
            recruiterInvitationRecipientId: context.recipientId,
        });
        if (!session) return { entry, initialSession: null };
        const answerHistoryRepository = createInvitedPracticeAnswerHistoryRepository(queryClient);
        const evaluationRuns = await answerHistoryRepository.listEvaluationRuns({
            invitedPracticeSessionId: context.sessionId,
            recruiterInvitationRecipientId: context.recipientId,
            purpose: "candidate_coaching",
        });
        return {
            entry,
            initialSession: toInvitedPracticeSharedSessionRecord(session, {
                evaluationRuns,
                now: new Date(),
                runtimeAvailable: isCandidateAnswerAnalysisRuntimeAvailable(process.env),
            }),
        };
    } catch {
        return null;
    }
}
