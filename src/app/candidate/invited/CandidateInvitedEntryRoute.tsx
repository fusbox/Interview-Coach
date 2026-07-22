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
import {
    createInvitedPracticeDebrief,
    type InvitedPracticeDebrief,
} from "@/features/recruiter-invites-v2/invited-practice-debrief";
import { toInvitedPracticeSharedSessionRecord } from "@/features/recruiter-invites-v2/invited-practice-session-recovery";
import { isCandidateAnswerAnalysisRuntimeAvailable } from "@/features/candidate-session-v2/candidate-answer-analysis-runtime-selection";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { isSessionQuestionAudioRuntimeAvailable } from "@/features/interview-session-v2/session-question-audio-runtime";
import { isVoiceTranscriptionRuntimeAvailable } from "@/features/interview-session-v2/voice-transcription-runtime";

import { InvitedPracticeEntryRouteExperience } from "./InvitedPracticeEntryRouteExperience";
import { InvitedPracticeCompleted } from "./InvitedPracticeCompleted";
import { InvitedPracticeUnavailable } from "./InvitedPracticeUnavailable";

type InvitedPracticeRouteState = {
    entry: InvitedPracticeEntryProjection;
    initialSession: CandidateProvisionalSessionRecord | null;
    completedDebrief?: InvitedPracticeDebrief | null;
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
        return state.completedDebrief
            ? <InvitedPracticeCompleted debrief={state.completedDebrief} />
            : <InvitedPracticeUnavailable />;
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
            questionAudioEnabled={isSessionQuestionAudioRuntimeAvailable(process.env)}
            voiceAnswerEnabled={isVoiceTranscriptionRuntimeAvailable(process.env)}
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
        if (entry.sessionStatus === "completed") {
            return {
                entry,
                initialSession: null,
                completedDebrief: createInvitedPracticeDebrief(session, entry.sessionAttemptNumber),
            };
        }
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
