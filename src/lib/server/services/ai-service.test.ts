import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderResponseError } from "@/lib/server/provider-errors";

const generateContentMock = vi.fn();
const incrementMetricMock = vi.fn();
const observeMetricMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const captureAiGenerationMock = vi.fn();

vi.mock("@/lib/server/services/ai-config", () => ({
    ai: {
        models: {
            generateContent: generateContentMock
        }
    },
    AI_MODELS: {
        ANALYSIS: "mock-analysis-model"
    }
}));

vi.mock("@/lib/server/metrics", () => ({
    incrementMetric: incrementMetricMock,
    observeMetric: observeMetricMock
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        error: loggerErrorMock,
        info: loggerInfoMock,
        warn: loggerWarnMock
    }
}));

vi.mock("@/lib/server/ai-quality/capture-ai-generation", () => ({
    captureAiGeneration: captureAiGenerationMock
}));

describe("AIService malformed provider handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captureAiGenerationMock.mockResolvedValue("generation-1");
    });

    it("records malformed_response metrics and returns fallback analysis", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                contentPulse: {
                    dimension: "not_a_real_dimension",
                    headline: "Bad payload",
                    body: "This should fail schema validation."
                }
            })
        });

        const { AIService } = await import("./ai-service");

        const result = await AIService.analyzeAnswer(
            { id: "q1", text: "Tell me about yourself", category: "general", index: 0 },
            "I have relevant experience.",
            null
        );

        expect(result.contentPulse?.headline).toBe("System Offline");
        expect(result.meta).not.toHaveProperty("readinessLevel");
        expect(incrementMetricMock).toHaveBeenCalledWith("ai_requests_total", {
            operation: "analysis",
            outcome: "malformed_response"
        });
        expect(observeMetricMock).toHaveBeenCalledWith(
            "ai_request_duration_ms",
            expect.any(Number),
            {
                operation: "analysis",
                outcome: "malformed_response"
            }
        );
        expect(loggerErrorMock).toHaveBeenCalledWith(
            "AI Analysis Failed",
            expect.objectContaining({
                provider: "gemini",
                operation: "analyzeAnswer",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            })
        );
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "answer_feedback",
            status: "failed",
            modelProvider: "gemini",
            rawOutput: expect.any(String),
            error: expect.objectContaining({
                operation: "analyzeAnswer",
                kind: "schema_validation"
            })
        }));
    });

    it("records malformed_response metrics and returns fallback summary", async () => {
        generateContentMock.mockResolvedValueOnce({
            text: "   "
        });

        const { AIService } = await import("./ai-service");

        const result = await AIService.summarizeSession({
            id: "session-1",
            role: "QA Engineer",
            status: "COMPLETED",
            questions: [],
            currentQuestionIndex: 0,
            answers: {},
            initialsRequired: false
        });

        expect(result).toContain("Executive Summary");
        expect(incrementMetricMock).toHaveBeenCalledWith("ai_requests_total", {
            operation: "session_summary",
            outcome: "malformed_response"
        });
        expect(loggerErrorMock).toHaveBeenCalledWith(
            "Session Summarization Failed",
            expect.objectContaining({
                provider: "gemini",
                operation: "summarizeSession",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            })
        );
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "session_debrief",
            status: "failed",
            modelProvider: "gemini",
            rawOutput: "   ",
            error: expect.objectContaining({
                operation: "summarizeSession",
                kind: "schema_validation"
            })
        }));
    });

    it("captures session debrief inputs as structured answers and job description artifact", async () => {
        generateContentMock.mockResolvedValueOnce({
            text: "### Executive Summary\nYou completed the session."
        });

        const { AIService } = await import("./ai-service");

        await AIService.summarizeSession({
            id: "session-1",
            recruiterId: "recruiter-1",
            role: "Data Entry Clerk",
            jobDescription: "Enter records for Brightpath Medical Clinic.",
            status: "COMPLETED",
            questions: [{ id: "q1", text: "What tools have you used?", category: "technical", index: 0 }],
            currentQuestionIndex: 0,
            answers: {
                q1: {
                    questionId: "q1",
                    transcript: "I used spreadsheets at Brightpath Medical Clinic.",
                    analysis: {
                        meta: { tier: 1, modality: "text" },
                        scores: {
                            focus_relevance: { score: 4, label: "Relevant example" },
                            structural_clarity: { score: 4, label: "Clear" },
                            specificity_concreteness: { score: 4, label: "Specific" },
                            outcome_explicitness: { score: 3, label: "Some outcome" },
                            decision_rationale: { score: 3, label: "Some rationale" },
                            filler_words: { score: 5, label: "No fillers" },
                            signposting: { score: 3, label: "Basic signposting" },
                            conciseness: { score: 4, label: "Concise" },
                            resilience: { score: 4, label: "Positive" }
                        }
                    }
                }
            },
            initialsRequired: false
        });

        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "session_debrief",
            status: "success",
            createdBy: "recruiter-1",
            inputSnapshot: expect.objectContaining({
                sessionId: "session-1",
                role: "Data Entry Clerk",
                hasJobDescription: true,
                answers: [
                    expect.objectContaining({
                        questionId: "q1",
                        questionText: "What tools have you used?",
                        transcript: "I used spreadsheets at [ORGANIZATION]."
                    })
                ]
            }),
            contextArtifacts: [
                expect.objectContaining({
                    type: "job_description",
                    content: "Enter records for [ORGANIZATION]."
                })
            ],
            privacyFlags: ["contains_session_transcripts"]
        }));
    });

    it("instructs answer feedback to generate one big upgrade as support for the next action", async () => {
        generateContentMock.mockResolvedValueOnce({
            text: JSON.stringify({
                feedbackPlan: {
                    centralRead: "The answer has a useful example but needs clearer outcome proof.",
                    signal: { valence: "mixed", detectability: "moderate" },
                    primaryAnchor: {
                        source: "content",
                        signalType: "quote",
                        dimension: "outcome_explicitness",
                        candidateEvidence: "I helped my team finish the checklist.",
                        interviewerValue: "Shows ownership but needs impact.",
                    },
                    intervention: {
                        type: "sharpen_signal",
                        reason: "The candidate should add an observable result.",
                    },
                },
                ack: "You gave a real teamwork example, which gives the interviewer something concrete to understand.",
                transcript: "I helped my team finish the checklist.",
                scores: {
                    focus_relevance: { score: 4, label: "Relevant" },
                    structural_clarity: { score: 4, label: "Clear" },
                    specificity_concreteness: { score: 3, label: "Some detail" },
                    outcome_explicitness: { score: 2, label: "Outcome is thin" },
                    decision_rationale: { score: 3, label: "Basic rationale" },
                    filler_words: { score: 5, label: "No issue" },
                    signposting: { score: 3, label: "Basic structure" },
                    conciseness: { score: 4, label: "Concise" },
                    resilience: { score: 4, label: "Positive" },
                },
                contentPulse: {
                    dimension: "outcome_explicitness",
                    headline: "Show the result",
                    body: "Your answer would be stronger if you named what changed after you helped.",
                    quote: "I helped my team finish the checklist.",
                },
                nextAction: {
                    label: "Retry My Answer",
                    actionType: "redo_answer",
                },
                recommendation: "Try again and add what changed because of your help.",
                coachSignal: {
                    focus: "Add the result of your action",
                    rationale: "This is the highest-leverage edit because the interviewer can already see effort, but not impact.",
                    targetMoment: "I helped my team finish the checklist.",
                    trySayingThis: "I helped my team finish the checklist, and we caught the missing items before the shift ended.",
                },
                meta: {
                    tier: 1,
                    modality: "text",
                },
            }),
        });

        const { AIService } = await import("./ai-service");

        const result = await AIService.analyzeAnswer(
            { id: "q1", text: "Tell me about a time you helped your team.", category: "behavioral", index: 0 },
            "I helped my team finish the checklist.",
            null,
            { title: "Warehouse Associate", competencies: [] },
        );

        const prompt = generateContentMock.mock.calls[0][0].contents.parts[0].text;

        expect(prompt).toContain("COACH SIGNAL");
        expect(prompt).toContain("support the existing nextAction");
        expect(prompt).toContain("NEVER mention internal nextAction.actionType values");
        expect(prompt).toContain("not a second strong response");
        expect(prompt).toContain("1-3 sentences");
        expect(result.coachSignal).toMatchObject({
            focus: "Add the result of your action",
            trySayingThis: expect.stringContaining("caught the missing items"),
        });
        expect(result.oneBigUpgrade).toBeUndefined();
        expect(result.meta).not.toHaveProperty("readinessLevel");
    });

    it("removes internal next-action literals from coach signal copy before returning analysis", async () => {
        generateContentMock.mockResolvedValueOnce({
            text: JSON.stringify({
                feedbackPlan: {
                    centralRead: "The answer is strong and only needs one final polish.",
                    signal: { valence: "strength", detectability: "clear" },
                    primaryAnchor: {
                        source: "content",
                        signalType: "quote",
                        dimension: "decision_rationale",
                        candidateEvidence: "I chose QBRs because they build trust.",
                        interviewerValue: "Shows strategic judgment.",
                    },
                    intervention: {
                        type: "amplify_strength",
                        reason: "The candidate already has a strong answer.",
                    },
                },
                ack: "You connected the tool choice to customer trust, which is a strong CSM signal.",
                transcript: "I chose QBRs because they build trust.",
                scores: {
                    focus_relevance: { score: 4, label: "Relevant" },
                    structural_clarity: { score: 4, label: "Clear" },
                    specificity_concreteness: { score: 4, label: "Specific" },
                    outcome_explicitness: { score: 4, label: "Impact" },
                    decision_rationale: { score: 5, label: "Strategic" },
                    filler_words: { score: 5, label: "No issue" },
                    signposting: { score: 4, label: "Organized" },
                    conciseness: { score: 4, label: "Concise" },
                    resilience: { score: 4, label: "Strong" },
                },
                contentPulse: {
                    dimension: "decision_rationale",
                    headline: "Show why the tool fits",
                    body: "You made the tool choice stronger by explaining why it matters.",
                    quote: "QBRs because they build trust",
                },
                nextAction: {
                    label: "See Session Summary",
                    actionType: "stop_for_now",
                },
                recommendation: "Finish the session and review the summary.",
                coachSignal: {
                    focus: "Explain the tool rationale",
                    rationale: "This supports the 'stop_for_now' by giving you a clear final polish.",
                    targetMoment: "QBRs because they build trust",
                    trySayingThis: "This stop_for_now improvement is to say I use QBRs because they uncover needs.",
                },
                meta: {
                    tier: 1,
                    modality: "text",
                },
            }),
        });

        const { AIService } = await import("./ai-service");

        const result = await AIService.analyzeAnswer(
            { id: "q1", text: "What customer success tools do you use?", category: "behavioral", index: 0 },
            "I chose QBRs because they build trust.",
            null,
            { title: "Senior CSM", competencies: [] },
            undefined,
            undefined,
            { current: 3, total: 3 },
        );

        expect(result.coachSignal?.rationale).not.toMatch(/stop_for_now|redo_answer|next_question|practice_example/);
        expect(result.coachSignal?.trySayingThis).not.toMatch(/stop_for_now|redo_answer|next_question|practice_example/);
        expect(result.oneBigUpgrade).toBeUndefined();
    });

    it("normalizes legacy one big upgrade provider output into coach signal", async () => {
        generateContentMock.mockResolvedValueOnce({
            text: JSON.stringify({
                ack: "You named a useful action.",
                scores: {
                    focus_relevance: { score: 4, label: "Relevant" },
                    structural_clarity: { score: 4, label: "Clear" },
                    specificity_concreteness: { score: 3, label: "Some detail" },
                    outcome_explicitness: { score: 3, label: "Outcome present" },
                    decision_rationale: { score: 3, label: "Basic rationale" },
                    filler_words: { score: 5, label: "No issue" },
                    signposting: { score: 3, label: "Basic structure" },
                    conciseness: { score: 4, label: "Concise" },
                    resilience: { score: 4, label: "Positive" },
                },
                oneBigUpgrade: {
                    focus: "Add one result",
                    rationale: "This gives the interviewer stronger proof.",
                    trySayingThis: "I finished the checklist and helped the team avoid a delay.",
                },
                nextAction: {
                    label: "Next question",
                    actionType: "next_question",
                },
                meta: {
                    tier: 1,
                    modality: "text",
                },
            }),
        });

        const { AIService } = await import("./ai-service");

        const result = await AIService.analyzeAnswer(
            { id: "q1", text: "Tell me about a time you helped your team.", category: "behavioral", index: 0 },
            "I helped my team finish the checklist.",
            null,
            { title: "Warehouse Associate", competencies: [] },
        );

        expect(result.coachSignal).toMatchObject({
            focus: "Add one result",
        });
        expect(result.oneBigUpgrade).toBeUndefined();
    });

    it("does not request or return candidate-only coach signal for recruiter app answer feedback", async () => {
        generateContentMock.mockResolvedValueOnce({
            text: JSON.stringify({
                feedbackPlan: {
                    centralRead: "The answer is relevant and organized.",
                    signal: { valence: "strength", detectability: "clear" },
                    primaryAnchor: {
                        source: "content",
                        signalType: "quote",
                        dimension: "focus_relevance",
                        candidateEvidence: "I would first confirm the issue.",
                        interviewerValue: "Shows practical troubleshooting.",
                    },
                    intervention: {
                        type: "amplify_strength",
                        reason: "The candidate gave a clear first step.",
                    },
                },
                ack: "You gave a clear troubleshooting first step.",
                transcript: "I would first confirm the issue.",
                scores: {
                    focus_relevance: { score: 4, label: "Relevant" },
                    structural_clarity: { score: 4, label: "Clear" },
                    specificity_concreteness: { score: 4, label: "Specific" },
                    outcome_explicitness: { score: 3, label: "Some outcome" },
                    decision_rationale: { score: 4, label: "Good rationale" },
                    filler_words: { score: 5, label: "No issue" },
                    signposting: { score: 4, label: "Organized" },
                    conciseness: { score: 4, label: "Concise" },
                    resilience: { score: 4, label: "Positive" },
                },
                contentPulse: {
                    dimension: "focus_relevance",
                    headline: "Start with confirmation",
                    body: "Your answer stayed focused on the client's immediate need.",
                    quote: "confirm the issue",
                },
                coachSignal: {
                    focus: "Candidate-only field",
                    rationale: "This should not be returned for recruiter-invited analysis.",
                    trySayingThis: "Candidate-only phrasing.",
                },
                nextAction: {
                    label: "Next question",
                    actionType: "next_question",
                },
                recommendation: "Continue to the next question.",
                meta: {
                    tier: 1,
                    modality: "text",
                },
            }),
        });

        const { AIService } = await import("./ai-service");

        const result = await AIService.analyzeAnswer(
            { id: "q1", text: "How would you troubleshoot an account login issue?", category: "behavioral", index: 0 },
            "I would first confirm the issue.",
            null,
            { title: "Support Specialist", competencies: [] },
            undefined,
            undefined,
            { current: 1, total: 3 },
            { appName: "recruiter_app" },
        );

        const prompt = generateContentMock.mock.calls[0][0].contents.parts[0].text;

        expect(prompt).not.toContain("COACH SIGNAL");
        expect(result.coachSignal).toBeUndefined();
        expect(result.oneBigUpgrade).toBeUndefined();
    });
});
