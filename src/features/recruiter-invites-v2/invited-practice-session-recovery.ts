import type { CandidateAnswerEvaluationRunRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { createSessionAnswerAnalysisRecoveries } from "@/features/interview-session-v2/session-answer-analysis-recovery";

import type { InvitedPracticeSessionRuntimeRecord } from "./invited-practice-session-runtime-repository";

export function toInvitedPracticeSharedSessionRecord(
    session: InvitedPracticeSessionRuntimeRecord,
    recoveryInput: {
        evaluationRuns: CandidateAnswerEvaluationRunRecord[];
        now: Date;
        runtimeAvailable?: boolean;
    },
): CandidateProvisionalSessionRecord {
    return {
        status: "session_created",
        sessionId: session.invitedPracticeSessionId,
        // Compatibility-only field on the shared client record. Invited routing
        // remains under /candidate/invited and never follows this value.
        nextRoute: `/candidate/session/${session.invitedPracticeSessionId}`,
        setupSnapshot: session.setupSnapshot,
        questionPlanSnapshot: session.questionPlanSnapshot,
        questionWordingSnapshot: session.questionWordingSnapshot,
        progress: session.progress,
        answerDrafts: session.answerDrafts,
        answerSubmissions: session.answerSubmissions,
        answerAnalysisSnapshots: session.answerAnalysisSnapshots,
        answerAnalysisRecoveries: createSessionAnswerAnalysisRecoveries({
            session,
            ...recoveryInput,
        }),
        feedbackActionEvents: session.feedbackActionEvents,
        voiceTranscriptDrafts: session.voiceTranscriptDrafts ?? {},
    };
}
