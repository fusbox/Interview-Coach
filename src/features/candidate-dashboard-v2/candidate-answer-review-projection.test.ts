import { describe, expect, it } from "vitest";

import { createCandidateAnswerAnalysisProviderRequest } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import { runFixtureEvidenceFirstEvaluator } from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";
import type { CandidateAnswerAttemptRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";

import { createCandidateAnswerReviewItems } from "./candidate-answer-review-projection";
import type { CandidateCoachPlanReference } from "./candidate-coach-plan-reference";
import type { CandidateQuestionPreparednessAcceptedRun } from "./candidate-question-preparedness-progress";

describe("candidate answer review projection", () => {
    it("uses canonical identity across sessions and selects the latest accepted attempt for every practiced question", async () => {
        const baseline = createBaselineSession();
        const followUp = createFollowUpSession(baseline);
        const attempts = [
            createAttempt("attempt-q1", baseline.candidatePracticeSessionId, "slot-1", 0, "First answer."),
            createAttempt("attempt-q2-old", baseline.candidatePracticeSessionId, "slot-2", 1, "Earlier answer."),
            createAttempt(
                "attempt-q2-new",
                followUp.candidatePracticeSessionId,
                "slot-1",
                0,
                "Latest answer.",
                "2026-08-07T11:00:00.000Z",
            ),
        ];
        const acceptedRuns = await Promise.all(attempts.map((attempt, index) => createAcceptedRun(
            attempt,
            index === 2 ? "Question 2" : `Question ${attempt.questionIndex + 1}`,
        )));

        const reviews = createCandidateAnswerReviewItems({
            candidateProfileId: "candidate-1",
            practiceSessions: [baseline, followUp],
            coachPlan: createCoachPlan(baseline.candidatePracticeSessionId),
            answerAttempts: attempts,
            acceptedRuns,
        });

        expect(reviews.map((review) => ({
            canonicalQuestion: review.canonicalQuestion.questionKey,
            sourceSession: review.sourceOccurrence.candidatePracticeSessionId,
            sourceQuestion: review.sourceOccurrence.questionKey,
            answer: review.answer.text,
        }))).toEqual([
            {
                canonicalQuestion: "slot-1",
                sourceSession: "baseline-session",
                sourceQuestion: "slot-1",
                answer: "First answer.",
            },
            {
                canonicalQuestion: "slot-2",
                sourceSession: "follow-up-session",
                sourceQuestion: "slot-1",
                answer: "Latest answer.",
            },
        ]);
        expect(reviews.every((review) => review.transcriptCanvas?.answerAttemptId)).toBe(true);
    });

    it("fails closed when an accepted run is absent from the compatible read projection", () => {
        const baseline = createBaselineSession();
        const reviews = createCandidateAnswerReviewItems({
            candidateProfileId: "candidate-1",
            practiceSessions: [baseline],
            coachPlan: createCoachPlan(baseline.candidatePracticeSessionId),
            answerAttempts: [createAttempt(
                "attempt-without-run",
                baseline.candidatePracticeSessionId,
                "slot-1",
                0,
                "Unprojected answer.",
            )],
            acceptedRuns: [],
        });

        expect(reviews).toEqual([]);
    });
});

function createBaselineSession(): CandidatePracticeSessionRecord {
    const plan = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 3 });
    return {
        candidatePracticeSessionId: "baseline-session",
        candidateProfileId: "candidate-1",
        roleProfileId: "role-1",
        candidateLaunchSessionId: null,
        status: "in_progress",
        setupSnapshot: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect products and document defects.",
            resumeText: null,
            interviewStage: "screening",
            questionCount: 3,
            resumeCaptureMode: "none",
            createdAt: "2026-08-07T09:00:00.000Z",
        },
        questionPlanSnapshot: plan,
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: plan.slots.map((slot) => ({
                slotId: slot.id,
                index: slot.index,
                category: slot.category,
                questionText: `Question ${slot.index + 1}`,
            })),
        },
        questionWordingStatus: "worded",
        progress: { status: "live_question", currentQuestionIndex: 2 },
        answerDrafts: {},
        answerSubmissions: {},
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
    };
}

function createFollowUpSession(baseline: CandidatePracticeSessionRecord): CandidatePracticeSessionRecord {
    const sourceQuestion = baseline.questionWordingSnapshot!.questions[1];
    return {
        ...baseline,
        candidatePracticeSessionId: "follow-up-session",
        status: "completed",
        setupSnapshot: {
            ...baseline.setupSnapshot,
            questionCount: 1,
            createdAt: "2026-08-07T10:00:00.000Z",
            followUpPractice: {
                status: "candidate_follow_up_practice_session",
                sourceIntentId: "intent-1",
                source: "practice_builder",
                sessionAttemptNumber: 1,
                itemCount: 1,
                items: [{
                    localSlotId: "slot-1",
                    localQuestionNumber: 1,
                    candidatePracticeSessionId: baseline.candidatePracticeSessionId,
                    questionKey: "slot-2",
                    sourceCandidatePracticeSessionId: baseline.candidatePracticeSessionId,
                    sourceQuestionKey: "slot-2",
                    rootSourceCandidatePracticeSessionId: baseline.candidatePracticeSessionId,
                    rootSourceQuestionKey: "slot-2",
                    sourceQuestionNumber: 2,
                    sourceQuestionText: sourceQuestion.questionText,
                    sourceCategory: "Screening",
                    questionAttemptNumber: 2,
                    practiceKind: "practice_from_feedback",
                }],
            },
        } as CandidatePracticeSessionRecord["setupSnapshot"],
        questionPlanSnapshot: {
            ...baseline.questionPlanSnapshot,
            questionCount: 1,
            slots: [{ ...baseline.questionPlanSnapshot.slots[1], id: "slot-1", index: 0 }],
        },
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [{ ...sourceQuestion, slotId: "slot-1", index: 0 }],
        },
        progress: { status: "completed", currentQuestionIndex: 0 },
        completionSnapshot: null,
    };
}

function createCoachPlan(baselineSessionId: string): CandidateCoachPlanReference {
    return {
        status: "candidate_coach_plan_reference_ready",
        source: {
            kind: "prep_context_baseline",
            baselineCandidatePracticeSessionId: baselineSessionId,
            roleProfileId: "role-1",
        },
        targetRole: "Quality Inspector",
        stage: { id: "screening", label: "Screening call", detail: "A first conversation." },
        questionCount: 3,
        practicedQuestionCount: 2,
        missingEvidenceCount: 1,
        categories: [],
        questions: [1, 2, 3].map((questionNumber) => ({
            questionKey: `slot-${questionNumber}`,
            questionNumber,
            category: "screening" as const,
            categoryLabel: "Screening",
            questionText: `Question ${questionNumber}`,
            evidenceStatus: questionNumber < 3 ? "practiced" as const : "missing_evidence" as const,
        })),
    };
}

function createAttempt(
    candidateAnswerAttemptId: string,
    candidatePracticeSessionId: string,
    questionSlotId: string,
    questionIndex: number,
    answerText: string,
    submittedAt = `2026-08-07T10:0${questionIndex + 1}:00.000Z`,
): CandidateAnswerAttemptRecord {
    return {
        candidateAnswerAttemptId,
        candidatePracticeSessionId,
        candidateProfileId: "candidate-1",
        questionSlotId,
        questionIndex,
        attemptNumber: 1,
        trigger: "initial_submit",
        supersedesCandidateAnswerAttemptId: null,
        mode: "text",
        answerText,
        submittedAt,
        idempotencyKey: `idempotency-${candidateAnswerAttemptId}`,
        payloadFingerprint: "a".repeat(64),
        sourceVoiceTranscriptionRunId: null,
        voiceSubmissionPath: null,
        voiceTranscriptEdited: null,
        createdAt: submittedAt,
    };
}

async function createAcceptedRun(
    attempt: CandidateAnswerAttemptRecord,
    questionText: string,
): Promise<CandidateQuestionPreparednessAcceptedRun> {
    if (attempt.mode === "photo") {
        throw new Error("The evaluator fixture accepts text or voice attempts only.");
    }
    const acceptedRun = await runFixtureEvidenceFirstEvaluator(
        createCandidateAnswerAnalysisProviderRequest({
            request: {
                status: "answer_analysis_requested",
                requestedAt: attempt.submittedAt,
                answerSubmission: {
                    slotId: attempt.questionSlotId,
                    questionIndex: attempt.questionIndex,
                    mode: attempt.mode,
                    text: attempt.answerText,
                    submittedAt: attempt.submittedAt,
                    status: "pending_analysis",
                    answerAttemptId: attempt.candidateAnswerAttemptId,
                    attemptNumber: attempt.attemptNumber,
                    trigger: attempt.trigger,
                },
            },
            question: {
                slotId: attempt.questionSlotId,
                index: attempt.questionIndex,
                category: "screening",
                questionText,
            },
            setupSnapshot: {
                targetRole: "Quality Inspector",
                jobDescription: "Inspect products and document defects.",
                resumeText: null,
                interviewStage: "screening",
                questionCount: 3,
                resumeCaptureMode: "none",
                createdAt: "2026-08-07T09:00:00.000Z",
            },
        }),
        { evaluationRunId: `run-${attempt.candidateAnswerAttemptId}` },
    );

    return {
        candidateAnswerAttemptId: attempt.candidateAnswerAttemptId,
        candidateAnswerEvaluationRunId: acceptedRun.evaluationRunId,
        completedAt: acceptedRun.completedAt,
        extraction: {
            answerUsability: acceptedRun.accepted.extraction.answerUsability,
            technicalAccuracy: acceptedRun.accepted.extraction.technicalAccuracy,
        },
        criteria: acceptedRun.accepted.criteria,
        acceptedRun,
    };
}
