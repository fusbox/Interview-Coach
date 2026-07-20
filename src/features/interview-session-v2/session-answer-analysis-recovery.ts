import {
    resolveCandidateAnswerAnalysisRecovery,
    type CandidateAnswerAnalysisRecoveries,
} from "@/features/candidate-session-v2/candidate-answer-analysis-recovery";
import type { CandidateAnswerEvaluationRunRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type { CandidateAnswerSubmissions } from "@/features/candidate-session-v2/candidate-answer-lifecycle";

export function createSessionAnswerAnalysisRecoveries(input: {
    session: {
        answerSubmissions: CandidateAnswerSubmissions;
        answerAnalysisSnapshots: Record<string, CandidateAnswerAnalysisProviderResult>;
    };
    evaluationRuns: CandidateAnswerEvaluationRunRecord[];
    now: Date;
    runtimeAvailable?: boolean;
}): CandidateAnswerAnalysisRecoveries {
    return Object.fromEntries(
        Object.entries(input.session.answerSubmissions).flatMap(([slotId, submission]) => {
            if (
                !submission.answerAttemptId
                || input.session.answerAnalysisSnapshots[slotId]?.answer.answerAttemptId === submission.answerAttemptId
            ) {
                return [];
            }

            return [[slotId, resolveCandidateAnswerAnalysisRecovery({
                runs: input.evaluationRuns.filter((run) => (
                    run.candidateAnswerAttemptId === submission.answerAttemptId
                )),
                now: input.now,
                runtimeAvailable: input.runtimeAvailable,
            })]];
        }),
    );
}
