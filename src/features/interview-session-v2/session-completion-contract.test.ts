import { describe, expect, it } from "vitest";

import { createCandidateLedSessionCompletion, createInvitedSessionCompletion } from "./session-completion-contract";
import { createSessionRuntimeFacts } from "./session-runtime-facts";

describe("session completion contract", () => {
    it("creates a candidate-led completion snapshot from shared runtime facts", () => {
        const facts = createSessionRuntimeFacts({
            audience: "candidate_led",
            sessionId: "candidate-practice-session-1",
            targetRole: "Material Handler",
            interviewStage: "first_interview",
            questionCount: 3,
            currentQuestionIndex: 2,
            questions: [
                {
                    questionKey: "slot-1",
                    questionIndex: 0,
                    category: "screening",
                    questionText: "What interests you about this Material Handler role?",
                    answer: {
                        mode: "text",
                        text: "I like keeping materials organized.",
                        submittedAt: "2026-07-10T22:01:00.000Z",
                        lifecycleStatus: "analysis_saved",
                    },
                    coachingFacts: {
                        status: "candidate_answer_coaching_facts",
                        provider: "candidate_v2_answer_evaluator",
                        analyzedAt: "2026-07-10T22:02:00.000Z",
                        answer: {
                            slotId: "slot-1",
                            questionIndex: 0,
                        },
                        coachFeedback: {
                            acknowledgement: "You gave a direct answer.",
                            observation: "Add a specific example.",
                            nextPracticeFocus: "Name one task you handled well.",
                        },
                        overallRead: {
                            band: "clear",
                            headline: "Clear evidence",
                            description: "The answer gives the coach usable evidence.",
                            observedCount: 1,
                            excludedCount: 0,
                        },
                        criteriaFacts: [],
                        coverage: {
                            observedCriteriaIds: ["answer_specificity"],
                            notElicitedCriteriaIds: [],
                            insufficientDataCriteriaIds: [],
                            unscoreableCriteriaIds: [],
                        },
                    },
                },
                {
                    questionKey: "slot-2",
                    questionIndex: 1,
                    category: "behavioral",
                    questionText: "Tell me about a time you handled a deadline.",
                    answer: {
                        mode: "text",
                        text: "I checked the inventory list and prioritized the urgent shipment.",
                        submittedAt: "2026-07-10T22:05:00.000Z",
                        lifecycleStatus: "pending_analysis",
                    },
                },
                {
                    questionKey: "slot-3",
                    questionIndex: 2,
                    category: "case_scenario",
                    questionText: "How would you handle a shipment delay?",
                },
            ],
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard",
            },
        });

        expect(createCandidateLedSessionCompletion({
            facts,
            completedAt: "2026-07-10T22:10:00.000Z",
        })).toEqual({
            status: "candidate_session_completed",
            audience: "candidate_led",
            sessionId: "candidate-practice-session-1",
            completedAt: "2026-07-10T22:10:00.000Z",
            finalProgress: {
                status: "completed",
                currentQuestionIndex: 2,
            },
            questionCount: 3,
            answeredCount: 2,
            coachedCount: 1,
            answeredQuestionKeys: ["slot-1", "slot-2"],
            coachedQuestionKeys: ["slot-1"],
            skippedOrUnansweredQuestionKeys: ["slot-3"],
            nextRoute: "/candidate/dashboard",
        });
    });

    it("does not create a candidate-led completion snapshot for invited candidate sessions", () => {
        const facts = createSessionRuntimeFacts({
            audience: "invited_candidate",
            sessionId: "invited-session-1",
            targetRole: "Customer Service Representative",
            interviewStage: "screening",
            questionCount: 1,
            currentQuestionIndex: 0,
            questions: [
                {
                    questionKey: "question-1",
                    questionIndex: 0,
                    category: "screening",
                    questionText: "Tell me about your background.",
                },
            ],
            completionBehavior: {
                kind: "invited_debrief",
            },
        });

        expect(createCandidateLedSessionCompletion({
            facts,
            completedAt: "2026-07-10T22:10:00.000Z",
        })).toBeNull();
        expect(createInvitedSessionCompletion({
            facts,
            completedAt: "2026-07-10T22:10:00.000Z",
        })).toMatchObject({
            status: "invited_session_completed",
            audience: "invited_candidate",
            nextRoute: "/candidate/invited",
            answeredCount: 0,
        });
    });
});
