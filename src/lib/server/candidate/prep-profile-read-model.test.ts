import { describe, expect, it } from "vitest";

import type { AnalysisResult, Question } from "@/lib/domain/types";

import { buildPrepProfileReadModel } from "./prep-profile-read-model";

const baseQuestion: Question = {
    id: "question-1",
    text: "Tell me about a time you helped a customer through a difficult issue.",
    category: "STAR",
    index: 0,
};

describe("prep profile read model", () => {
    it("derives release dashboard lanes from hidden numeric scores and keeps categories separate", () => {
        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Client Service Coordinator",
            jobDescription: "Support clients, coordinate schedules, and communicate clearly.",
            sessionId: "session-1",
            questions: [
                baseQuestion,
                {
                    ...baseQuestion,
                    id: "question-2",
                    text: "Why are you interested in this role?",
                    category: "Screening",
                    framework: "Interest",
                    index: 1,
                },
                {
                    ...baseQuestion,
                    id: "question-3",
                    text: "Tell me about a time you changed your approach for a customer.",
                    category: "STAR",
                    index: 2,
                },
            ],
            answers: [
                {
                    questionId: "question-1",
                    transcript: "I helped a client, explained the options, and fixed the schedule.",
                    submittedAt: 1000,
                    analysis: analysisResult({
                        valence: "mixed",
                        detectability: "clear",
                        interventionType: "polish_response",
                        scores: {
                            focus_relevance: 3,
                            specificity_concreteness: 3,
                            outcome_explicitness: 2,
                            decision_rationale: 2,
                            structural_clarity: 4,
                            signposting: 4,
                            filler_words: 3,
                            conciseness: 3,
                            resilience: 3,
                        },
                    }),
                },
                {
                    questionId: "question-2",
                    transcript: "I like helping clients and this schedule works for me.",
                    submittedAt: 2000,
                    analysis: analysisResult({
                        valence: "growth",
                        detectability: "thin",
                        interventionType: "repair_foundation",
                        scores: {
                            focus_relevance: 2,
                            specificity_concreteness: 1,
                            outcome_explicitness: 1,
                            decision_rationale: 2,
                            structural_clarity: 2,
                            signposting: 2,
                            filler_words: 3,
                            conciseness: 4,
                            resilience: 3,
                        },
                    }),
                },
            ],
        });

        expect(model.signals.map((signal) => signal.lane)).toEqual([
            "answer_substance",
            "interview_structure",
            "communication_delivery",
        ]);
        expect(model.signals.find((signal) => signal.signalId === "lane:answer_substance")).toMatchObject({
            label: "Answer Substance",
            evidenceState: "emerging",
            averageScore: 2,
            fillPercent: 0,
            dimensionStates: [
                {
                    dimension: "focus_relevance",
                    label: "Focus",
                    evidenceState: "emerging",
                    averageScore: 2.5,
                    scoreCount: 2,
                },
                {
                    dimension: "specificity_concreteness",
                    label: "Specific detail",
                    evidenceState: "emerging",
                    averageScore: 2,
                    scoreCount: 2,
                },
                {
                    dimension: "outcome_explicitness",
                    label: "Outcome clarity",
                    evidenceState: "emerging",
                    averageScore: 1.5,
                    scoreCount: 2,
                },
                {
                    dimension: "decision_rationale",
                    label: "Decision logic",
                    evidenceState: "emerging",
                    averageScore: 2,
                    scoreCount: 2,
                },
            ],
            evidenceCounts: {
                not_practiced: 0,
                emerging: 1,
                clear: 0,
                strong: 0,
            },
        });
        expect(model.signals.find((signal) => signal.signalId === "lane:interview_structure")).toMatchObject({
            label: "Interview Structure",
            evidenceState: "clear",
            averageScore: 3,
            fillPercent: 0,
        });
        expect(model.signals.find((signal) => signal.signalId === "lane:communication_delivery")).toMatchObject({
            label: "Communication Delivery",
            evidenceState: "clear",
            averageScore: 3.17,
            fillPercent: 17,
        });
        expect(model.categoryCards).toEqual([
            expect.objectContaining({
                categoryId: "behavioral",
                label: "Behavioral",
                questionCount: 2,
                practicedQuestionCount: 1,
                upcomingQuestionCount: 1,
                questionStatuses: [
                    {
                        questionId: "question-1",
                        questionNumber: 1,
                        questionText: "Tell me about a time you helped a customer through a difficult issue.",
                        status: "practiced",
                    },
                    {
                        questionId: "question-3",
                        questionNumber: 3,
                        questionText: "Tell me about a time you changed your approach for a customer.",
                        status: "upcoming",
                    },
                ],
                evidenceState: "clear",
                laneStates: {
                    answer_substance: {
                        evidenceState: "emerging",
                        averageScore: 2.5,
                        scoreCount: 4,
                    },
                    interview_structure: {
                        evidenceState: "strong",
                        averageScore: 4,
                        scoreCount: 2,
                    },
                    communication_delivery: {
                        evidenceState: "clear",
                        averageScore: 3,
                        scoreCount: 3,
                    },
                },
            }),
            expect.objectContaining({
                categoryId: "screening",
                label: "Screening",
                questionCount: 1,
                evidenceState: "emerging",
                laneStates: {
                    answer_substance: {
                        evidenceState: "emerging",
                        averageScore: 1.5,
                        scoreCount: 4,
                    },
                    interview_structure: {
                        evidenceState: "emerging",
                        averageScore: 2,
                        scoreCount: 2,
                    },
                    communication_delivery: {
                        evidenceState: "clear",
                        averageScore: 3.33,
                        scoreCount: 3,
                    },
                },
            }),
        ]);
    });

    it("seeds target interview and category signals into the immutable preparedness lanes", () => {
        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Customer Success Manager",
            jobDescription: "Own renewals, customer health, and executive stakeholder engagement.",
            resumeContextState: "processed",
            questions: [baseQuestion],
            answers: [],
        });

        expect(model.signals).toEqual(expect.arrayContaining([
            expect.objectContaining({
                signalId: "interview_context",
                label: "Prepare for Customer Success Manager",
                lane: "role_fit",
                evidenceState: "clear",
            }),
            expect.objectContaining({
                signalId: "category:behavioral",
                label: "Practice Behavioral questions",
                lane: "interview_range",
                evidenceState: "not_practiced",
                sourceRefs: expect.arrayContaining([
                    expect.objectContaining({ type: "resume_context", label: "Processed resume context available" }),
                ]),
            }),
        ]));
        expect(model.signals.map((signal) => signal.lane)).not.toContain("resume_bridge");
        expect(model.recommendation).toMatchObject({
            source: "first_practice",
            label: "Practice practice behavioral questions",
        });
    });

    it("keeps planned category coverage visible before the first answer is scored", () => {
        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Client Services Representative",
            jobDescription: "Help clients resolve account issues and explain next steps clearly.",
            sessionId: "session-1",
            questions: [
                {
                    ...baseQuestion,
                    id: "question-1",
                    category: "Screening",
                    text: "Why are you interested in this client services role?",
                    index: 0,
                },
                {
                    ...baseQuestion,
                    id: "question-2",
                    category: "STAR",
                    text: "Tell me about a time you helped an upset client.",
                    index: 1,
                },
                {
                    ...baseQuestion,
                    id: "question-3",
                    category: "Technical / Role-Specific",
                    text: "How would you help someone who cannot log in?",
                    index: 2,
                },
            ],
            answers: [],
        });

        expect(model.categoryCards).toEqual([
            expect.objectContaining({
                categoryId: "screening",
                label: "Screening",
                questionCount: 1,
                practicedQuestionCount: 0,
                upcomingQuestionCount: 1,
                evidenceState: "not_practiced",
                questionStatuses: [{
                    questionId: "question-1",
                    questionNumber: 1,
                    questionText: "Why are you interested in this client services role?",
                    status: "upcoming",
                }],
            }),
            expect.objectContaining({
                categoryId: "behavioral",
                label: "Behavioral",
                questionCount: 1,
                practicedQuestionCount: 0,
                upcomingQuestionCount: 1,
                evidenceState: "not_practiced",
                questionStatuses: [{
                    questionId: "question-2",
                    questionNumber: 2,
                    questionText: "Tell me about a time you helped an upset client.",
                    status: "upcoming",
                }],
            }),
            expect.objectContaining({
                categoryId: "technical_role_specific",
                label: "Technical / Role-Specific",
                questionCount: 1,
                practicedQuestionCount: 0,
                upcomingQuestionCount: 1,
                evidenceState: "not_practiced",
                questionStatuses: [{
                    questionId: "question-3",
                    questionNumber: 3,
                    questionText: "How would you help someone who cannot log in?",
                    status: "upcoming",
                }],
            }),
        ]);
    });

    it("elevates a signal immediately when the latest evidence is strong while preserving prior weak evidence", () => {
        const questionTwo: Question = {
            ...baseQuestion,
            id: "question-2",
            text: "Tell me about a time you improved a process.",
            index: 1,
        };

        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Support Lead",
            jobDescription: "Lead escalations and improve support processes.",
            sessionId: "session-1",
            questions: [baseQuestion, questionTwo],
            answers: [
                {
                    questionId: "question-1",
                    transcript: "I helped a customer.",
                    submittedAt: 1000,
                    analysis: analysisResult({
                        valence: "growth",
                        detectability: "thin",
                        interventionType: "repair_foundation",
                    }),
                },
                {
                    questionId: "question-2",
                    transcript: "I changed the checklist and reduced escalations.",
                    submittedAt: 2000,
                    analysis: analysisResult({
                        valence: "strength",
                        detectability: "clear",
                        interventionType: "amplify_strength",
                    }),
                },
            ],
        });

        const behavioralSignal = model.signals.find((signal) => signal.signalId === "category:behavioral");

        expect(behavioralSignal).toMatchObject({
            evidenceState: "strong",
            evidenceCounts: {
                not_practiced: 0,
                emerging: 1,
                clear: 0,
                strong: 1,
            },
            sourceRefs: expect.arrayContaining([
                expect.objectContaining({ type: "feedback_plan", id: "question-1", label: "Starting to build evidence" }),
                expect.objectContaining({ type: "feedback_plan", id: "question-2", label: "Strong evidence shown" }),
            ]),
        });
        expect(model.recommendation.label).not.toBe("Practice practice behavioral questions");
    });

    it("treats repeated latest weak evidence after stronger history as a current growth signal", () => {
        const questions: Question[] = [
            baseQuestion,
            {
                ...baseQuestion,
                id: "question-2",
                text: "Tell me about a time you improved a process.",
                index: 1,
            },
            {
                ...baseQuestion,
                id: "question-3",
                text: "Tell me about a time you handled conflicting instructions.",
                index: 2,
            },
        ];

        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Support Lead",
            jobDescription: "Lead escalations and improve support processes.",
            sessionId: "session-1",
            questions,
            answers: [
                {
                    questionId: "question-1",
                    transcript: "I changed the checklist and reduced escalations.",
                    submittedAt: 1000,
                    analysis: analysisResult({
                        valence: "strength",
                        detectability: "clear",
                        interventionType: "amplify_strength",
                    }),
                },
                {
                    questionId: "question-2",
                    transcript: "I tried to help.",
                    submittedAt: 2000,
                    analysis: analysisResult({
                        valence: "growth",
                        detectability: "thin",
                        interventionType: "repair_foundation",
                    }),
                },
                {
                    questionId: "question-3",
                    transcript: "I would ask somebody.",
                    submittedAt: 3000,
                    analysis: analysisResult({
                        valence: "growth",
                        detectability: "thin",
                        interventionType: "repair_foundation",
                    }),
                },
            ],
        });

        const behavioralSignal = model.signals.find((signal) => signal.signalId === "category:behavioral");

        expect(behavioralSignal).toMatchObject({
            evidenceState: "emerging",
            evidenceCounts: {
                not_practiced: 0,
                emerging: 2,
                clear: 0,
                strong: 1,
            },
        });
        expect(model.recommendation).toMatchObject({
            source: "answer_feedback",
        });
        expect(model.recommendation.sourceRefs.some((ref) => ref.label === "Starting to build evidence")).toBe(true);
    });

    it("derives emerging evidence from growth feedback without exposing scores", () => {
        const analysis = analysisResult({
            valence: "growth",
            detectability: "thin",
            interventionType: "repair_foundation",
        });

        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Operations Clerk",
            jobDescription: "Track orders, solve exceptions, and communicate clearly.",
            sessionId: "session-1",
            questions: [baseQuestion],
            answers: [{ questionId: "question-1", transcript: "I would try hard.", submittedAt: Date.now(), analysis }],
        });

        expect(model.signals).toEqual(expect.arrayContaining([
            expect.objectContaining({
                signalId: "category:behavioral",
                evidenceState: "emerging",
            }),
            expect.objectContaining({
                signalId: "content:focus_relevance",
                label: "Answer the question being asked",
                lane: "answer_substance",
                evidenceState: "emerging",
            }),
        ]));
        expect(model.observations).toEqual([
            expect.objectContaining({
                source: "feedback_plan",
                state: "thin",
                summary: "The answer needs a more specific customer example.",
            }),
        ]);
        expect(model.recommendation).toMatchObject({
            source: "answer_feedback",
            label: "Practice answer the question being asked",
        });
    });

    it("derives answer-substance signals from feedback plan anchors when no content pulse exists", () => {
        const analysis = analysisResult({
            valence: "mixed",
            detectability: "clear",
            interventionType: "sharpen_signal",
            primaryAnchorDimension: "decision_rationale",
            primaryAnchorSource: "content",
            contentPulse: null,
        });

        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Operations Manager",
            jobDescription: "Explain operational tradeoffs and decision rationale.",
            sessionId: "session-1",
            questions: [baseQuestion],
            answers: [{ questionId: "question-1", transcript: "I chose the safer process first.", submittedAt: 1000, analysis }],
        });

        expect(model.signals).toEqual(expect.arrayContaining([
            expect.objectContaining({
                signalId: "content:decision_rationale",
                label: "Explain why you chose that action",
                lane: "answer_substance",
                evidenceState: "clear",
                sourceRefs: expect.arrayContaining([
                    expect.objectContaining({
                        type: "feedback_plan",
                        id: "question-1",
                        label: "Decision rationale",
                        excerpt: "The answer mentions effort but not a clear customer situation.",
                    }),
                ]),
            }),
        ]));
    });

    it("derives communication-delivery signals from delivery feedback plan anchors when no delivery pulse exists", () => {
        const analysis = analysisResult({
            valence: "growth",
            detectability: "ambiguous",
            interventionType: "sharpen_signal",
            primaryAnchorDimension: "conciseness",
            primaryAnchorSource: "delivery",
            deliveryPulse: null,
        });

        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Support Specialist",
            jobDescription: "Communicate clearly with customers under pressure.",
            sessionId: "session-1",
            questions: [baseQuestion],
            answers: [{ questionId: "question-1", transcript: "I would explain a lot of context.", submittedAt: 1000, analysis }],
        });

        expect(model.signals).toEqual(expect.arrayContaining([
            expect.objectContaining({
                signalId: "delivery:conciseness",
                label: "Keep the answer tight",
                lane: "communication_delivery",
                evidenceState: "emerging",
                sourceRefs: expect.arrayContaining([
                    expect.objectContaining({
                        type: "feedback_plan",
                        id: "question-1",
                        label: "Conciseness",
                    }),
                ]),
            }),
        ]));
    });

    it("promotes repeated clear category evidence to strong", () => {
        const questionTwo: Question = {
            ...baseQuestion,
            id: "question-2",
            text: "Tell me about a time you improved a process.",
            index: 1,
        };
        const analysis = analysisResult({
            valence: "mixed",
            detectability: "clear",
            interventionType: "polish_response",
        });

        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Manufacturing Technician",
            jobDescription: "Follow process, solve problems, and communicate production issues.",
            sessionId: "session-1",
            questions: [baseQuestion, questionTwo],
            answers: [
                { questionId: "question-1", transcript: "I fixed the issue and told the team.", submittedAt: Date.now(), analysis },
                { questionId: "question-2", transcript: "I changed the checklist and reduced mistakes.", submittedAt: Date.now(), analysis },
            ],
        });

        expect(model.signals).toEqual(expect.arrayContaining([
            expect.objectContaining({
                signalId: "category:behavioral",
                evidenceState: "strong",
                evidenceCounts: {
                    not_practiced: 0,
                    emerging: 0,
                    clear: 2,
                    strong: 0,
                },
                sourceRefs: expect.arrayContaining([
                    expect.objectContaining({ id: "question-1" }),
                    expect.objectContaining({ id: "question-2" }),
                ]),
            }),
        ]));
    });

    it("prioritizes unfinished sessions before feedback-derived recommendations", () => {
        const model = buildPrepProfileReadModel({
            prepProfileId: "profile-1",
            targetRole: "Support Lead",
            jobDescription: "Lead escalations and coach support agents.",
            activeSessionHref: "/session/session-1",
            questions: [baseQuestion],
            answers: [{
                questionId: "question-1",
                transcript: "I would coach the agent.",
                submittedAt: Date.now(),
                analysis: analysisResult({
                    valence: "growth",
                    detectability: "thin",
                    interventionType: "repair_foundation",
                }),
            }],
        });

        expect(model.recommendation).toMatchObject({
            source: "unfinished_session",
            label: "Resume Support Lead",
            href: "/session/session-1",
        });
    });
});

function analysisResult({
    valence,
    detectability,
    interventionType,
    primaryAnchorDimension = "focus_relevance",
    primaryAnchorSource = "content",
    contentPulse = {
        dimension: "focus_relevance",
        headline: "Stay on the prompt",
        body: "The answer should describe one customer issue and what you did.",
    },
    deliveryPulse,
    scores,
}: {
    valence: "strength" | "mixed" | "growth";
    detectability: "clear" | "moderate" | "ambiguous" | "thin";
    interventionType: "amplify_strength" | "sharpen_signal" | "repair_foundation" | "polish_response";
    primaryAnchorDimension?: NonNullable<AnalysisResult["feedbackPlan"]>["primaryAnchor"]["dimension"];
    primaryAnchorSource?: NonNullable<AnalysisResult["feedbackPlan"]>["primaryAnchor"]["source"];
    contentPulse?: AnalysisResult["contentPulse"] | null;
    deliveryPulse?: AnalysisResult["deliveryPulse"] | null;
    scores?: Partial<Record<keyof NonNullable<AnalysisResult["scores"]>, number>>;
}): AnalysisResult {
    const defaultScores: NonNullable<AnalysisResult["scores"]> = {
        focus_relevance: { score: 2, label: "Needs work" },
        structural_clarity: { score: 3, label: "Developing" },
        outcome_explicitness: { score: 2, label: "Needs work" },
        specificity_concreteness: { score: 2, label: "Needs work" },
        decision_rationale: { score: 2, label: "Needs work" },
        filler_words: { score: 3, label: "Developing" },
        signposting: { score: 3, label: "Developing" },
        conciseness: { score: 3, label: "Developing" },
        resilience: { score: 3, label: "Developing" },
    };
    const scoreMap = Object.fromEntries(
        Object.entries(defaultScores).map(([dimension, score]) => [
            dimension,
            {
                ...score,
                score: scores?.[dimension as keyof NonNullable<AnalysisResult["scores"]>] ?? score.score,
            },
        ]),
    ) as NonNullable<AnalysisResult["scores"]>;

    return {
        feedbackPlan: {
            centralRead: "The answer needs a more specific customer example.",
            signal: {
                valence,
                detectability,
            },
            primaryAnchor: {
                source: primaryAnchorSource,
                signalType: "pattern",
                dimension: primaryAnchorDimension,
                candidateEvidence: "The answer mentions effort but not a clear customer situation.",
                interviewerValue: "Interviewers need a concrete example.",
            },
            intervention: {
                type: interventionType,
                reason: "Add a clearer example.",
            },
        },
        contentPulse: contentPulse ?? undefined,
        deliveryPulse: deliveryPulse ?? undefined,
        nextAction: {
            actionType: "redo_answer",
            label: "Retry answer",
        },
        scores: scores ? scoreMap : undefined,
    };
}
