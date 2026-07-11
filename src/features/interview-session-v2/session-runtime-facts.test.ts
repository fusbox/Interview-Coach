import { describe, expect, it } from "vitest";

import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import {
    createSessionRuntimeFacts,
    type SessionRuntimeFactQuestion,
} from "./session-runtime-facts";

const analysisSnapshot: CandidateAnswerAnalysisProviderResult = {
    status: "answer_analysis_provider_result",
    provider: "candidate_v2_answer_evaluator",
    analyzedAt: "2026-07-10T22:03:00.000Z",
    answer: {
        slotId: "slot-1",
        questionIndex: 0,
    },
    coachFeedback: {
        acknowledgement: "You named a practical first step.",
        observation: "The answer would be stronger with the result.",
        nextPracticeFocus: "Add what changed after you made the decision.",
    },
    evidence: [
        {
            criterionId: "answer_specificity",
            applicability: "observed",
            score: 3.4,
        },
    ],
};

describe("session runtime facts", () => {
    it("normalizes candidate-led practice-session facts into the shared runtime shape", () => {
        const questions: SessionRuntimeFactQuestion[] = [
            {
                questionKey: "slot-1",
                questionIndex: 0,
                category: "screening",
                questionText: "What interests you about this Material Handler role?",
                answer: {
                    mode: "text",
                    text: "I want work where I can stay organized and keep materials moving.",
                    submittedAt: "2026-07-10T22:02:00.000Z",
                    lifecycleStatus: "pending_analysis",
                },
                coachingFacts: {
                    status: "candidate_answer_coaching_facts",
                    provider: "candidate_v2_answer_evaluator",
                    analyzedAt: "2026-07-10T22:03:00.000Z",
                    answer: {
                        slotId: "slot-1",
                        questionIndex: 0,
                    },
                    coachFeedback: analysisSnapshot.coachFeedback,
                    overallRead: {
                        band: "clear",
                        headline: "Clear evidence",
                        description: "The practiced answer gives the coach enough evidence to show a clear pattern.",
                        observedCount: 1,
                        excludedCount: 0,
                    },
                    criteriaFacts: [
                        {
                            criterionId: "answer_specificity",
                            applicability: "observed",
                            band: "clear",
                            evidenceState: "observed",
                        },
                    ],
                    coverage: {
                        observedCriteriaIds: ["answer_specificity"],
                        notElicitedCriteriaIds: [],
                        insufficientDataCriteriaIds: [],
                        unscoreableCriteriaIds: [],
                    },
                },
            },
        ];

        expect(createSessionRuntimeFacts({
            audience: "candidate_led",
            sessionId: "candidate-practice-session-1",
            targetRole: "Material Handler",
            interviewStage: "first_interview",
            questionCount: 1,
            currentQuestionIndex: 0,
            questions,
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard",
            },
        })).toEqual({
            status: "session_runtime_facts",
            audience: "candidate_led",
            sessionId: "candidate-practice-session-1",
            targetRole: "Material Handler",
            interviewStage: "first_interview",
            questionCount: 1,
            currentQuestionIndex: 0,
            questions,
            answeredCount: 1,
            coachedCount: 1,
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard",
            },
        });
    });

    it("normalizes invited-candidate session facts into the same question and answer shape", () => {
        const facts = createSessionRuntimeFacts({
            audience: "invited_candidate",
            sessionId: "legacy-invited-session-1",
            targetRole: "Customer Service Representative",
            interviewStage: "screening",
            questionCount: 2,
            currentQuestionIndex: 1,
            questions: [
                {
                    questionKey: "question-1",
                    questionIndex: 0,
                    category: "screening",
                    questionText: "Tell me about your customer service background.",
                    answer: {
                        mode: "voice",
                        text: "I helped customers at the front desk and resolved scheduling questions.",
                        submittedAt: "2026-07-10T22:04:00.000Z",
                        lifecycleStatus: "analysis_saved",
                    },
                },
                {
                    questionKey: "question-2",
                    questionIndex: 1,
                    category: "behavioral",
                    questionText: "Tell me about a time you handled a frustrated customer.",
                },
            ],
            completionBehavior: {
                kind: "invited_debrief",
            },
        });

        expect(facts).toMatchObject({
            status: "session_runtime_facts",
            audience: "invited_candidate",
            answeredCount: 1,
            coachedCount: 0,
            completionBehavior: {
                kind: "invited_debrief",
            },
            questions: [
                {
                    questionKey: "question-1",
                    questionIndex: 0,
                    answer: {
                        mode: "voice",
                        lifecycleStatus: "analysis_saved",
                    },
                },
                {
                    questionKey: "question-2",
                    questionIndex: 1,
                },
            ],
        });
        expect(facts.questions[1]).not.toHaveProperty("answer");
    });

    it("keeps candidate-only identity and host-launch details outside the shared runtime facts", () => {
        const facts = createSessionRuntimeFacts({
            audience: "candidate_led",
            sessionId: "candidate-practice-session-1",
            targetRole: "Material Handler",
            interviewStage: "first_interview",
            questionCount: 0,
            currentQuestionIndex: 99,
            questions: [],
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard",
            },
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidateLaunchSessionId: "33333333-3333-4333-8333-333333333333",
            setupSnapshot: {
                resumeText: "Candidate resume content",
            },
        });

        expect(facts.currentQuestionIndex).toBe(0);
        expect(JSON.stringify(facts)).not.toMatch(/candidateProfileId|candidateLaunchSessionId|setupSnapshot|resumeText/);
    });
});
