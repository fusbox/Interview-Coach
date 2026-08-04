import { describe, expect, it } from "vitest";

import { createCandidateAnswerAnalysisProviderResultFixture } from "./candidate-answer-analysis-test-fixture";
import { createCandidateCompletedRoundReadModels } from "./candidate-completed-round-read-model";
import { createCandidateQuestionPlan } from "./candidate-question-plan";
import type { CandidatePracticeSessionRecord } from "./candidate-practice-session-repository";

const analysisSnapshot = createCandidateAnswerAnalysisProviderResultFixture({
    analyzedAt: "2026-07-10T22:03:00.000Z",
    answer: {
        slotId: "slot-1",
        questionIndex: 0,
    },
    coachFeedback: {
        acknowledgement: "You gave a direct answer.",
        observation: "Add a specific example from the shift.",
        nextPracticeFocus: "Try the question again with one concrete example.",
    },
    evidenceFirst: {
        candidateFeedback: {
            biggestUpgrade: "Name one task you handled well and what changed.",
            redoPrompt: "Try the question again with one concrete example.",
        },
    },
});

describe("candidate completed round read model", () => {
    it("bridges a completed candidate practice session into dashboard and post-round review models", () => {
        const session = createCompletedSessionRecord();

        expect(createCandidateCompletedRoundReadModels(session)).toEqual({
            status: "candidate_completed_round_read_models",
            round: {
                candidatePracticeSessionId: "session-1",
                targetRole: "Material Handler I",
                interviewStage: "first_interview",
                completedAt: "2026-07-10T22:10:00.000Z",
                questionCount: 3,
                answeredCount: 2,
                coachedCount: 1,
                skippedOrUnansweredCount: 1,
            },
            dashboardUpdate: {
                status: "candidate_dashboard_coach_update_ready",
                candidatePracticeSessionId: "session-1",
                title: "Material Handler I practice complete",
                body: "You answered 2 of 3 questions. I have coaching ready for 1 answer.",
                href: "/candidate/dashboard",
                completedAt: "2026-07-10T22:10:00.000Z",
                answeredCount: 2,
                questionCount: 3,
                coachingPreview: {
                    questionKey: "slot-1",
                    questionNumber: 1,
                    category: "Screening",
                    observation: "Add a specific example from the shift.",
                    nextPracticeFocus: "Try the question again with one concrete example.",
                },
            },
            postRoundReview: {
                status: "candidate_post_round_review_ready",
                candidatePracticeSessionId: "session-1",
                targetRole: "Material Handler I",
                completedAt: "2026-07-10T22:10:00.000Z",
                answeredCount: 2,
                questionCount: 3,
                questions: [
                    {
                        questionKey: "slot-1",
                        questionNumber: 1,
                        category: "Screening",
                        questionText: "What interests you about this Material Handler role?",
                        status: "practiced",
                        answer: {
                            mode: "text",
                            text: "I like keeping materials organized.",
                            submittedAt: "2026-07-10T22:01:00.000Z",
                        },
                        coaching: {
                            acknowledgement: "You gave a direct answer.",
                            observation: "Add a specific example from the shift.",
                            nextPracticeFocus: "Try the question again with one concrete example.",
                            recommendedMove: "Name one task you handled well and what changed.",
                        },
                    },
                    {
                        questionKey: "slot-2",
                        questionNumber: 2,
                        category: "Behavioral",
                        questionText: "Tell me about a time you handled a deadline.",
                        status: "practiced",
                        answer: {
                            mode: "text",
                            text: "I prioritized the urgent shipment.",
                            submittedAt: "2026-07-10T22:05:00.000Z",
                        },
                    },
                    {
                        questionKey: "slot-3",
                        questionNumber: 3,
                        category: "Scenario",
                        questionText: "How would you handle a shipment delay?",
                        status: "skipped_or_unanswered",
                    },
                ],
            },
            practiceNext: {
                status: "candidate_practice_next_ready",
                source: "unanswered_question",
                label: "Practice the questions you did not answer",
                reason: "One planned question still needs practice evidence.",
                href: "/candidate/setup",
                questionKeys: ["slot-3"],
            },
        });
    });

    it("does not expose raw scores, averages, or legacy coach feedback fields", () => {
        const model = createCandidateCompletedRoundReadModels(createCompletedSessionRecord());

        expect(JSON.stringify(model)).not.toMatch(/score|averageScore|oneBigUpgrade|readinessLevel/i);
    });

    it("carries follow-up session and question attempt lineage without treating repeated practice as a new baseline question", () => {
        const model = createCandidateCompletedRoundReadModels(createCompletedSessionRecord({
            candidatePracticeSessionId: "follow-up-session-2",
            followUpPractice: {
                sourceIntentId: "intent-1",
                sessionAttemptNumber: 2,
                itemCount: 1,
                items: [{
                    localSlotId: "slot-1",
                    localQuestionNumber: 1,
                    candidatePracticeSessionId: "source-session-1",
                    questionKey: "slot-1",
                    sourceCandidatePracticeSessionId: "source-session-1",
                    sourceQuestionKey: "slot-1",
                    rootSourceCandidatePracticeSessionId: "root-session-1",
                    rootSourceQuestionKey: "slot-4",
                    sourceQuestionNumber: 4,
                    sourceQuestionText: "What interests you about this Material Handler role?",
                    sourceCategory: "Screening",
                    questionAttemptNumber: 2,
                    practiceKind: "practice_from_feedback",
                }],
            },
        }));

        expect(model?.round.attemptContext).toEqual({
            isFollowUpPractice: true,
            sessionAttemptNumber: 2,
            sourceIntentId: "intent-1",
            itemCount: 1,
        });
        expect(model?.postRoundReview.questions).toHaveLength(1);
        expect(model?.postRoundReview.questions[0]).toMatchObject({
            questionKey: "slot-1",
            questionNumber: 1,
            attemptContext: {
                isFollowUpPractice: true,
                sessionAttemptNumber: 2,
                questionAttemptNumber: 2,
                sourceCandidatePracticeSessionId: "source-session-1",
                sourceQuestionKey: "slot-1",
                rootSourceCandidatePracticeSessionId: "root-session-1",
                rootSourceQuestionKey: "slot-4",
                sourceQuestionNumber: 4,
                practiceKind: "practice_from_feedback",
            },
        });
    });

    it("returns null when the durable session is not completed or lacks a completion snapshot", () => {
        const completedSession = createCompletedSessionRecord();

        expect(createCandidateCompletedRoundReadModels({
            ...completedSession,
            status: "in_progress",
        })).toBeNull();
        expect(createCandidateCompletedRoundReadModels({
            ...completedSession,
            completionSnapshot: null,
        })).toBeNull();
    });
});

function createCompletedSessionRecord({
    candidatePracticeSessionId = "session-1",
    followUpPractice,
}: {
    candidatePracticeSessionId?: string;
    followUpPractice?: {
        sourceIntentId: string;
        sessionAttemptNumber: number;
        itemCount: number;
        items: Array<{
            localSlotId: string;
            localQuestionNumber: number;
            candidatePracticeSessionId: string;
            questionKey: string;
            sourceCandidatePracticeSessionId: string;
            sourceQuestionKey: string;
            rootSourceCandidatePracticeSessionId?: string;
            rootSourceQuestionKey?: string;
            sourceQuestionNumber: number;
            sourceQuestionText: string;
            sourceCategory: string;
            questionAttemptNumber: number;
            practiceKind: "practice_from_feedback" | "practice_missing_evidence";
        }>;
    };
} = {}): CandidatePracticeSessionRecord {
    const questions = followUpPractice
        ? [{
            slotId: "slot-1",
            index: 0,
            category: "screening" as const,
            questionText: "What interests you about this Material Handler role?",
        }]
        : [
            {
                slotId: "slot-1",
                index: 0,
                category: "screening" as const,
                questionText: "What interests you about this Material Handler role?",
            },
            {
                slotId: "slot-2",
                index: 1,
                category: "behavioral" as const,
                questionText: "Tell me about a time you handled a deadline.",
            },
            {
                slotId: "slot-3",
                index: 2,
                category: "case_scenario" as const,
                questionText: "How would you handle a shipment delay?",
            },
        ];

    return {
        candidatePracticeSessionId,
        candidateProfileId: "22222222-2222-4222-8222-222222222222",
        roleProfileId: null,
        candidateLaunchSessionId: null,
        status: "completed",
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials and maintain inventory.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 3,
            resumeCaptureMode: "none",
            createdAt: "2026-07-10T22:00:00.000Z",
            ...(followUpPractice
                ? {
                    followUpPractice: {
                        status: "candidate_follow_up_practice_session",
                        sourceIntentId: followUpPractice.sourceIntentId,
                        source: "practice_builder",
                        sessionAttemptNumber: followUpPractice.sessionAttemptNumber,
                        itemCount: followUpPractice.itemCount,
                        items: followUpPractice.items,
                    },
                }
                : {}),
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 3,
        }),
        questionWordingSnapshot: {
            status: "questions_worded",
            questions,
            ...(followUpPractice
                ? {
                    followUpPractice: {
                        sourceIntentId: followUpPractice.sourceIntentId,
                        source: "practice_builder",
                        sessionAttemptNumber: followUpPractice.sessionAttemptNumber,
                        itemCount: followUpPractice.itemCount,
                    },
                }
                : {}),
        },
        questionWordingStatus: "worded",
        progress: {
            status: "completed",
            currentQuestionIndex: 2,
        },
        answerDrafts: {},
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I like keeping materials organized.",
                submittedAt: "2026-07-10T22:01:00.000Z",
                status: "pending_analysis",
            },
            "slot-2": {
                slotId: "slot-2",
                questionIndex: 1,
                mode: "text",
                text: "I prioritized the urgent shipment.",
                submittedAt: "2026-07-10T22:05:00.000Z",
                status: "pending_analysis",
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {
            "slot-1": analysisSnapshot,
        },
        feedbackActionEvents: {},
        completionSnapshot: {
            status: "candidate_session_completed",
            audience: "candidate_led",
            sessionId: "session-1",
            completedAt: "2026-07-10T22:10:00.000Z",
            finalProgress: {
                status: "completed",
                currentQuestionIndex: 2,
            },
            questionCount: 3,
            answeredCount: followUpPractice ? 1 : 2,
            coachedCount: 1,
            answeredQuestionKeys: ["slot-1", "slot-2"],
            coachedQuestionKeys: ["slot-1"],
            skippedOrUnansweredQuestionKeys: followUpPractice ? [] : ["slot-3"],
            nextRoute: "/candidate/dashboard",
        },
    };
}
