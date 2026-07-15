import { describe, expect, it } from "vitest";

import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";

import {
    createCandidateQaEvalCasesFromPracticeSession,
    createCandidateQaEvalComparisonSnapshot,
    createCandidateQaEvalRunSnapshot,
} from "./candidate-qa-evaluation-export";

describe("candidate QA evaluation export", () => {
    it("creates one redacted QA case per submitted worded answer without app/source ownership", () => {
        const cases = createCandidateQaEvalCasesFromPracticeSession(createPracticeSessionFixture());

        expect(cases).toHaveLength(1);
        expect(cases[0]).toMatchObject({
            status: "candidate_qa_eval_case",
            schemaVersion: 1,
            caseId: "candidate-qa-case:practice-session-1:slot-1",
            candidatePracticeSessionId: "practice-session-1",
            candidateProfileId: "redacted",
            setupContext: {
                targetRole: "Material Handler I",
                resumeIncluded: true,
            },
            question: {
                slotId: "slot-1",
                questionIndex: 0,
                category: "behavioral",
            },
            answer: {
                mode: "text",
                text: "I labeled the incoming materials, checked the count, and asked my lead before moving damaged items.",
            },
            privacy: {
                candidateProfileId: "redacted",
                hasResumeText: true,
            },
        });
        expect(JSON.stringify(cases[0])).not.toContain("candidate-profile-1");
        expect(cases[0]).not.toHaveProperty("sourceApp");
        expect(cases[0]).not.toHaveProperty("appName");
        expect(cases[0].expectedSignals).toEqual(expect.arrayContaining([
            expect.objectContaining({ criterionId: "decision_rationale", expectedApplicability: "observed" }),
        ]));
    });

    it("omits unanswered and unworded questions from the QA case export", () => {
        expect(createCandidateQaEvalCasesFromPracticeSession({
            ...createPracticeSessionFixture(),
            answerSubmissions: {},
        })).toEqual([]);
        expect(createCandidateQaEvalCasesFromPracticeSession({
            ...createPracticeSessionFixture(),
            questionWordingSnapshot: null,
        })).toEqual([]);
    });

    it("gives each immutable answer attempt its own QA case identity", () => {
        const session = createPracticeSessionFixture();
        const firstAttempt = {
            ...session.answerSubmissions["slot-1"],
            answerAttemptId: "11111111-1111-4111-8111-111111111111",
            attemptNumber: 1,
            trigger: "initial_submit" as const,
            supersedesAnswerAttemptId: null,
        };
        const secondAttempt = {
            ...firstAttempt,
            answerAttemptId: "22222222-2222-4222-8222-222222222222",
            attemptNumber: 2,
            trigger: "feedback_retry" as const,
            supersedesAnswerAttemptId: firstAttempt.answerAttemptId,
            text: "I clarified the damage, separated the materials, and documented the result for my lead.",
        };

        const [firstCase] = createCandidateQaEvalCasesFromPracticeSession({
            ...session,
            answerSubmissions: { "slot-1": firstAttempt },
        });
        const [secondCase] = createCandidateQaEvalCasesFromPracticeSession({
            ...session,
            answerSubmissions: { "slot-1": secondAttempt },
        });

        expect(firstCase.caseId).toBe(
            "candidate-qa-case:practice-session-1:slot-1:11111111-1111-4111-8111-111111111111",
        );
        expect(secondCase.caseId).toBe(
            "candidate-qa-case:practice-session-1:slot-1:22222222-2222-4222-8222-222222222222",
        );
        expect(firstCase.inputFingerprint).not.toBe(secondCase.inputFingerprint);
    });

    it("builds model run snapshots from the same stable case input", () => {
        const [qaCase] = createCandidateQaEvalCasesFromPracticeSession(createPracticeSessionFixture());
        const run = createCandidateQaEvalRunSnapshot({
            qaCase,
            analysis: createAnalysisFixture("2026-07-10T12:01:00.000Z"),
            model: {
                provider: "openai",
                name: "gpt-4.1-mini",
                promptVersion: "answer-coach-v2.1",
                evaluatorVersion: "candidate-answer-evaluator-2026-07",
            },
            requestedAt: "2026-07-10T12:00:59.000Z",
            latencyMs: 842,
            tokenUsage: {
                inputTokens: 100,
                outputTokens: 80,
                totalTokens: 180,
            },
        });

        expect(run).toMatchObject({
            status: "candidate_qa_eval_run",
            caseId: qaCase.caseId,
            inputFingerprint: qaCase.inputFingerprint,
            provider: "candidate_v2_answer_evaluator",
            validation: {
                mapsToCaseInput: true,
                evidenceHasObservedScoresOnly: true,
                candidateSafeProjectionHasNoRawScores: true,
            },
        });
    });

    it("flags candidate-safety and schema regressions in run snapshots", () => {
        const [qaCase] = createCandidateQaEvalCasesFromPracticeSession(createPracticeSessionFixture());
        const run = createCandidateQaEvalRunSnapshot({
            qaCase,
            analysis: {
                ...createAnalysisFixture("2026-07-10T12:01:00.000Z"),
                answer: {
                    slotId: "slot-2",
                    questionIndex: 1,
                },
                coachFeedback: {
                    acknowledgement: "Your score is 4/5.",
                    observation: "This answer uses a concrete example.",
                    nextPracticeFocus: "Add a clearer result.",
                },
                evidence: [
                    { criterionId: "focus_relevance", applicability: "observed", score: 4 },
                    { criterionId: "decision_rationale", applicability: "not_elicited", score: 1 } as never,
                ],
            },
            model: {
                provider: "openai",
                name: "gpt-4.1-mini",
                promptVersion: "answer-coach-v2.1",
                evaluatorVersion: "candidate-answer-evaluator-2026-07",
            },
            requestedAt: "2026-07-10T12:00:59.000Z",
        });

        expect(run.validation).toEqual({
            mapsToCaseInput: false,
            evidenceHasObservedScoresOnly: false,
            candidateSafeProjectionHasNoRawScores: false,
        });
    });

    it("compares two model responses only when they use the same fixed case input", () => {
        const [qaCase] = createCandidateQaEvalCasesFromPracticeSession(createPracticeSessionFixture());
        const variantA = createCandidateQaEvalRunSnapshot({
            qaCase,
            analysis: createAnalysisFixture("2026-07-10T12:01:00.000Z"),
            model: {
                provider: "openai",
                name: "gpt-4.1-mini",
                promptVersion: "answer-coach-v2.1",
                evaluatorVersion: "candidate-answer-evaluator-2026-07",
            },
            requestedAt: "2026-07-10T12:00:59.000Z",
        });
        const variantB = createCandidateQaEvalRunSnapshot({
            qaCase,
            analysis: createAnalysisFixture("2026-07-10T12:02:00.000Z"),
            model: {
                provider: "anthropic",
                name: "claude-sonnet-4",
                promptVersion: "answer-coach-v2.1",
                evaluatorVersion: "candidate-answer-evaluator-2026-07",
            },
            requestedAt: "2026-07-10T12:01:59.000Z",
        });

        expect(createCandidateQaEvalComparisonSnapshot({
            comparisonId: "comparison-1",
            variantA,
            variantB,
        })).toMatchObject({
            status: "candidate_qa_eval_comparison",
            caseId: qaCase.caseId,
            inputFingerprint: qaCase.inputFingerprint,
            judgment: {
                preference: "not_reviewed",
                flags: ["needs_human_review"],
            },
        });
    });

    it("flags model comparisons that accidentally use different case inputs", () => {
        const [variantACase] = createCandidateQaEvalCasesFromPracticeSession(createPracticeSessionFixture());
        const [variantBCase] = createCandidateQaEvalCasesFromPracticeSession({
            ...createPracticeSessionFixture(),
            candidatePracticeSessionId: "practice-session-2",
            answerSubmissions: {
                "slot-1": {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "A different answer changes the case input.",
                    submittedAt: "2026-07-10T12:00:00.000Z",
                    status: "pending_analysis",
                },
            },
        });
        const variantA = createCandidateQaEvalRunSnapshot({
            qaCase: variantACase,
            analysis: createAnalysisFixture("2026-07-10T12:01:00.000Z"),
            model: {
                provider: "openai",
                name: "gpt-4.1-mini",
                promptVersion: "answer-coach-v2.1",
                evaluatorVersion: "candidate-answer-evaluator-2026-07",
            },
            requestedAt: "2026-07-10T12:00:59.000Z",
        });
        const variantB = createCandidateQaEvalRunSnapshot({
            qaCase: variantBCase,
            analysis: createAnalysisFixture("2026-07-10T12:02:00.000Z"),
            model: {
                provider: "anthropic",
                name: "claude-sonnet-4",
                promptVersion: "answer-coach-v2.1",
                evaluatorVersion: "candidate-answer-evaluator-2026-07",
            },
            requestedAt: "2026-07-10T12:01:59.000Z",
        });

        expect(createCandidateQaEvalComparisonSnapshot({
            comparisonId: "comparison-2",
            variantA,
            variantB,
        })).toMatchObject({
            caseId: "mismatched_case_input",
            inputFingerprint: "mismatched_case_input",
            judgment: {
                flags: expect.arrayContaining(["different_case_input", "needs_human_review"]),
            },
        });
    });
});

function createPracticeSessionFixture(): CandidatePracticeSessionRecord {
    return {
        candidatePracticeSessionId: "practice-session-1",
        candidateProfileId: "candidate-profile-1",
        roleProfileId: "role-profile-1",
        candidateLaunchSessionId: "launch-session-1",
        status: "in_progress",
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials, label inventory, and follow warehouse safety procedures.",
            resumeText: "Warehouse associate with inventory and forklift experience.",
            interviewStage: "first_interview",
            questionCount: 1,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-10T12:00:00.000Z",
        },
        questionPlanSnapshot: {
            interviewStage: "first_interview",
            questionCount: 1,
            categoryCounts: {
                screening: 0,
                behavioral: 1,
                culture_fit: 0,
                case_scenario: 0,
                technical_role_specific: 0,
            },
            slots: [{
                id: "slot-1",
                index: 0,
                category: "behavioral",
                label: "Behavioral",
                purpose: "Real past examples that show what you personally did and what changed.",
            }],
        },
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [{
                slotId: "slot-1",
                index: 0,
                category: "behavioral",
                questionText: "Tell me about a time you handled damaged incoming materials.",
            }],
        },
        questionWordingStatus: "worded",
        progress: {
            status: "live_question",
            currentQuestionIndex: 0,
        },
        answerDrafts: {},
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I labeled the incoming materials, checked the count, and asked my lead before moving damaged items.",
                submittedAt: "2026-07-10T12:00:45.000Z",
                status: "pending_analysis",
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
    };
}

function createAnalysisFixture(analyzedAt: string): CandidateAnswerAnalysisProviderResult {
    return {
        status: "answer_analysis_provider_result",
        provider: "candidate_v2_answer_evaluator",
        analyzedAt,
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
        },
        coachFeedback: {
            acknowledgement: "You gave a clear warehouse example.",
            observation: "The answer explains the task and your action, but the result could be clearer.",
            nextPracticeFocus: "Add what changed after you escalated the damaged items.",
        },
        evidence: [
            { criterionId: "focus_relevance", applicability: "observed", score: 4 },
            { criterionId: "specificity_concreteness", applicability: "observed", score: 3.5 },
            { criterionId: "decision_rationale", applicability: "insufficient_data" },
        ],
    };
}
