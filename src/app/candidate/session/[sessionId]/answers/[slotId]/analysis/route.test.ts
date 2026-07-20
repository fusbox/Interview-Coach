import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    candidateAnswerAnalysisFixtureRunMetadata,
    createFixtureEvidenceFirstEvaluationCase,
    runFixtureEvidenceFirstEvaluator,
} from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";
import type { CandidateAnswerAnalysisProviderRequest } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type { EvidenceFirstEvaluatorResolvedConfigurationManifest } from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import {
    createCandidateAnswerAnalysisDevelopmentRuntime,
    resetCandidateAnswerAnalysisFaultInjectionState,
} from "@/features/candidate-session-v2/candidate-answer-analysis-fault-injection";
import { createCandidateAnswerAnalysisGoogleRuntime } from "@/features/candidate-session-v2/candidate-answer-analysis-google-runtime";
import { candidateQuestionPlanCategoryDetails } from "@/features/candidate-session-v2/candidate-question-plan";
import type { GoogleEvidenceFirstTransport } from "@/features/evaluation-v2/google-evidence-first-evaluator";
import { EvidenceFirstEvaluatorRuntimeError } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

import {
    createDefaultCandidateAnswerAnalysisDependencies,
    handleCandidateAnswerAnalysisRequest,
    resolveCandidateAnswerAnalysisIdentityFromDevLaunchCookie,
} from "./route-implementation";

afterEach(() => {
    vi.unstubAllEnvs();
    resetCandidateAnswerAnalysisFaultInjectionState();
});

describe("/candidate/session/[sessionId]/answers/[slotId]/analysis route", () => {
    it("resolves explicit dev host-launch cookies for answer analysis requests", () => {
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        expect(resolveCandidateAnswerAnalysisIdentityFromDevLaunchCookie(
            "ic_candidate_launch_session=dev-host-launch-100001",
        )).toEqual({
            candidateProfileId: "10000000-0000-4000-8000-000000000001",
        });
    });

    it("assembles no default analysis provider when provider config is missing", () => {
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "");

        expect(createDefaultCandidateAnswerAnalysisDependencies().requestAnswerAnalysis).toBeUndefined();
    });

    it("assembles the deterministic fixture analysis provider only for explicit local dev validation", async () => {
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "fixture");

        const provider = createDefaultCandidateAnswerAnalysisDependencies().requestAnswerAnalysis;

        const result = await provider?.({
            status: "answer_analysis_provider_requested",
            provider: "candidate_v2_answer_evaluator",
            requestedAt: "2026-07-09T20:02:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                answerAttemptId: "attempt-1",
                attemptNumber: 1,
                trigger: "initial_submit",
            },
            question: {
                slotId: "slot-1",
                questionIndex: 0,
                category: "behavioral",
                questionText: "Tell me about a time you prioritized similar work.",
                plannedPurpose: "Real past examples that show what you personally did and what changed.",
            },
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials and maintain inventory.",
                resumeText: null,
                interviewStage: "first_interview",
                questionCount: 7,
            },
        });

        expect(result).toMatchObject({
            status: "evidence_first_evaluator_run_accepted",
            contractVersion: "candidate_evidence_first_v2",
            accepted: {
                feedback: {
                    feedbackPlan: { intervention: "revise_answer" },
                },
                candidateProjection: {
                    status: "candidate_safe_feedback",
                },
            },
            retention: {
                assembledPrompt: "not_captured",
                rawProviderOutput: "not_captured",
            },
        });
        expect(JSON.stringify(result)).not.toMatch(/"score"/);
    });

    it("assembles an allowlisted fail-first runtime only from explicit local server environment", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "fault");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE", "provider_5xx_once");

        const dependencies = createDefaultCandidateAnswerAnalysisDependencies();
        const request = createProviderRequest();

        await expect(dependencies.requestAnswerAnalysis?.(request, { evaluationRunId: "run-failed" }))
            .rejects.toMatchObject({ errorCode: "PROVIDER_5XX" });
        await expect(dependencies.requestAnswerAnalysis?.(request, { evaluationRunId: "run-recovered" }))
            .resolves.toMatchObject({
                status: "evidence_first_evaluator_run_accepted",
                evaluationRunId: "run-recovered",
            });
        expect(dependencies.evaluationRunConfiguration).toMatchObject({
            provider: "candidate_v2_evidence_first_pipeline",
            modelName: "deterministic_fault_provider_5xx_once_v1",
        });
    });

    it("does not assemble the fixture analysis provider outside explicit local dev validation", () => {
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "false");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "fixture");

        expect(createDefaultCandidateAnswerAnalysisDependencies().requestAnswerAnalysis).toBeUndefined();
    });

    it("does not assemble the fault runtime in a production process", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "fault");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE", "provider_5xx_once");

        expect(createDefaultCandidateAnswerAnalysisDependencies().requestAnswerAnalysis).toBeUndefined();
    });

    it("reads a candidate-owned pending answer and fails closed while the analysis provider is unavailable", async () => {
        const findSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            setupSnapshot: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials and maintain inventory.",
                resumeText: null,
                interviewStage: "first_interview" as const,
                questionCount: 7,
                resumeCaptureMode: "none" as const,
                createdAt: "2026-07-09T20:00:00.000Z",
            },
            questionWordingSnapshot: {
                status: "questions_worded" as const,
                questions: [
                    {
                        slotId: "slot-1",
                        index: 0,
                        category: "behavioral" as const,
                        questionText: "Tell me about a time you prioritized similar work.",
                    },
                ],
            },
            answerSubmissions: {
                "slot-1": {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text" as const,
                    text: "I would ask a clarifying question first.",
                    submittedAt: "2026-07-09T20:01:00.000Z",
                    status: "pending_analysis" as const,
                },
            },
        }));
        const requestAnswerAnalysis = vi.fn(async () => null);

        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession,
            },
            requestAnswerAnalysis,
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            status: "answer_analysis_unavailable",
            reason: "provider_not_configured",
            retryable: false,
            analysisRecovery: {
                status: "answer_analysis_recovery",
                state: "unavailable",
                canRetryAnalysis: false,
                canContinueWithoutCoaching: true,
            },
            request: {
                status: "answer_analysis_requested",
                requestedAt: "2026-07-09T20:02:00.000Z",
                answerSubmission: {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                    submittedAt: "2026-07-09T20:01:00.000Z",
                    status: "pending_analysis",
                },
            },
        });
        expect(findSetupSession).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
        });
        expect(requestAnswerAnalysis).toHaveBeenCalledWith({
            status: "answer_analysis_provider_requested",
            provider: "candidate_v2_answer_evaluator",
            requestedAt: "2026-07-09T20:02:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
            },
            question: {
                slotId: "slot-1",
                questionIndex: 0,
                category: "behavioral",
                questionText: "Tell me about a time you prioritized similar work.",
                plannedPurpose: "Real past examples that show what you personally did and what changed.",
            },
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials and maintain inventory.",
                resumeText: null,
                interviewStage: "first_interview",
                questionCount: 7,
            },
        });
    });

    it("clears a pending idempotency record when the analysis provider throws", async () => {
        const clearAnswerIdempotencyRecord = vi.fn(async () => ({}));
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 7,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [{
                            slotId: "slot-1",
                            index: 0,
                            category: "behavioral" as const,
                            questionText: "Tell me about a time you prioritized similar work.",
                        }],
                    },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "I would ask a clarifying question first.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                        },
                    },
                    answerIdempotencyRecords: {},
                })),
                saveAnswerIdempotencyRecord: vi.fn(async () => ({})),
                clearAnswerIdempotencyRecord,
            },
            requestAnswerAnalysis: vi.fn(async () => {
                throw new Error("provider unavailable");
            }),
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            code: "ANSWER_ANALYSIS_FAILED",
            error: "Candidate coaching could not be prepared.",
            retryable: true,
            analysisRecovery: {
                status: "answer_analysis_recovery",
                state: "retryable",
                canRetryAnalysis: true,
                canContinueWithoutCoaching: true,
            },
        });
        expect(clearAnswerIdempotencyRecord).toHaveBeenCalledWith(expect.objectContaining({
            candidatePracticeSessionId: "session-1",
            recordKey: expect.stringContaining("candidate_answer_analysis:session-1:slot-1"),
        }));
    });

    it("fails closed when candidate identity is unavailable", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => null),
            practiceSessionRepository: {
                findSetupSession: vi.fn(),
            },
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate session identity is required.",
        });
    });

    it("does not request analysis when the candidate-owned session has no pending answer for the slot", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    candidatePracticeSessionId: "session-1",
                    candidateProfileId: "22222222-2222-4222-8222-222222222222",
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 7,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [
                            {
                                slotId: "slot-1",
                                index: 0,
                                category: "behavioral" as const,
                                questionText: "Tell me about a time you prioritized similar work.",
                            },
                        ],
                    },
                    answerSubmissions: {},
                })),
            },
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate pending answer was not found.",
        });
    });

    it("persists a valid provider result as an isolated V2 analysis snapshot", async () => {
        const analysisSnapshot = {
            status: "answer_analysis_provider_result" as const,
            provider: "candidate_v2_answer_evaluator" as const,
            analyzedAt: "2026-07-09T20:03:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            coachFeedback: {
                acknowledgement: "You named a practical first step.",
                observation: "The answer would be stronger with the result of your choice.",
                nextPracticeFocus: "Add what changed after you set the priority.",
            },
            evidence: [
                {
                    criterionId: "answer_specificity",
                    applicability: "observed" as const,
                    score: 3,
                },
            ],
        };
        const saveAnswerAnalysisSnapshot = vi.fn(async () => ({
            "slot-1": analysisSnapshot,
        }));

        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    candidatePracticeSessionId: "session-1",
                    candidateProfileId: "22222222-2222-4222-8222-222222222222",
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 7,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [
                            {
                                slotId: "slot-1",
                                index: 0,
                                category: "behavioral" as const,
                                questionText: "Tell me about a time you prioritized similar work.",
                            },
                        ],
                    },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "I would ask a clarifying question first.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                        },
                    },
                })),
                saveAnswerAnalysisSnapshot,
            },
            requestAnswerAnalysis: vi.fn(async () => analysisSnapshot),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "answer_analysis_saved",
            analysisSnapshot,
        });
        expect(saveAnswerAnalysisSnapshot).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            analysisSnapshot,
        });
    });

    it("persists accepted fixture coaching as a normalized evaluator run before the session projection", async () => {
        const saveAnswerAnalysisSnapshot = vi.fn(async (input) => ({
            "slot-1": input.analysisSnapshot,
        }));
        const claimEvaluationRun = vi.fn(async (input) => ({
            outcome: "created" as const,
            run: {
                candidateAnswerEvaluationRunId: "run-1",
                candidateAnswerAttemptId: input.candidateAnswerAttemptId,
                purpose: input.purpose,
                provider: input.provider,
                modelName: input.modelName,
                promptVersion: input.promptVersion,
                evaluatorVersion: input.evaluatorVersion,
                configurationManifest: input.configurationManifest,
                configurationFingerprint: input.configurationFingerprint,
                inputFingerprint: input.inputFingerprint,
                idempotencyKey: input.idempotencyKey,
                generationAttempt: 1,
                lifecycleState: "requested" as const,
                result: null,
                validation: null,
                errorCode: null,
                requestedAt: input.requestedAt,
                claimExpiresAt: input.claimExpiresAt,
                completedAt: null,
                createdAt: input.requestedAt,
                updatedAt: input.requestedAt,
            },
        }));
        const completeEvaluationRun = vi.fn(async (input) => ({
            candidateAnswerEvaluationRunId: input.candidateAnswerEvaluationRunId,
            candidateAnswerAttemptId: input.candidateAnswerAttemptId,
            purpose: "candidate_coaching" as const,
            provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
            modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
            promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
            evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
            configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
            inputFingerprint: input.validation.inputFingerprint as string,
            idempotencyKey: "analysis-key",
            generationAttempt: 1,
            lifecycleState: "completed" as const,
            result: input.result,
            validation: input.validation,
            errorCode: null,
            requestedAt: "2026-07-09T20:02:00.000Z",
            claimExpiresAt: "2026-07-09T20:03:00.000Z",
            completedAt: input.completedAt,
            createdAt: "2026-07-09T20:02:00.000Z",
            updatedAt: input.completedAt,
        }));

        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 1,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [{
                            slotId: "slot-1",
                            index: 0,
                            category: "behavioral" as const,
                            questionText: "Tell me about a time you prioritized similar work.",
                        }],
                    },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "I would ask a clarifying question first.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                            answerAttemptId: "attempt-1",
                            attemptNumber: 1,
                            trigger: "initial_submit" as const,
                            supersedesAnswerAttemptId: null,
                        },
                    },
                })),
                saveAnswerAnalysisSnapshot,
            },
            requestAnswerAnalysis: async (request, context) => runFixtureEvidenceFirstEvaluator(request, {
                evaluationRunId: context?.evaluationRunId,
            }),
            evaluationRunRepository: {
                claimEvaluationRun,
                completeEvaluationRun,
                failEvaluationRun: vi.fn(async () => null),
            },
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: (request) => createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint,
            },
        });

        expect(response.status).toBe(200);
        expect(claimEvaluationRun).toHaveBeenCalledWith(expect.objectContaining({
            candidateAnswerAttemptId: "attempt-1",
            purpose: "candidate_coaching",
            configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
            requestedAt: "2026-07-09T20:02:00.000Z",
            claimExpiresAt: "2026-07-09T20:03:00.000Z",
        }));
        expect(completeEvaluationRun).toHaveBeenCalledWith(expect.objectContaining({
            candidateAnswerEvaluationRunId: "run-1",
            result: expect.objectContaining({
                status: "evidence_first_evaluator_run_accepted",
                evaluationRunId: "run-1",
            }),
            validation: expect.objectContaining({
                disposition: "accepted",
                candidateSafeProjection: true,
                internalStageArtifacts: true,
            }),
        }));
        expect(saveAnswerAnalysisSnapshot).toHaveBeenCalledOnce();
        const savedProjection = saveAnswerAnalysisSnapshot.mock.calls[0][0].analysisSnapshot;
        expect(savedProjection.evidenceFirst).toMatchObject({
            candidateFeedback: { status: "candidate_safe_feedback" },
            interaction: { intervention: "revise_answer" },
        });
        expect(savedProjection.evidenceFirst).not.toHaveProperty("feedbackPlan");
        expect(savedProjection.evidenceFirst).not.toHaveProperty("criteria");
        expect(savedProjection.evidenceFirst).not.toHaveProperty("patternGap");
    });

    it("does not call the provider when a fresh evaluator claim is replayed", async () => {
        const requestAnswerAnalysis = vi.fn(async () => {
            throw new Error("provider should not be called");
        });
        const claimEvaluationRun = vi.fn(async (input) => ({
            outcome: "replayed" as const,
            run: {
                candidateAnswerEvaluationRunId: "run-1",
                candidateAnswerAttemptId: input.candidateAnswerAttemptId,
                purpose: input.purpose,
                provider: input.provider,
                modelName: input.modelName,
                promptVersion: input.promptVersion,
                evaluatorVersion: input.evaluatorVersion,
                configurationManifest: input.configurationManifest,
                configurationFingerprint: input.configurationFingerprint,
                inputFingerprint: input.inputFingerprint,
                idempotencyKey: input.idempotencyKey,
                generationAttempt: 1,
                lifecycleState: "requested" as const,
                result: null,
                validation: null,
                errorCode: null,
                requestedAt: input.requestedAt,
                claimExpiresAt: input.claimExpiresAt,
                completedAt: null,
                createdAt: input.requestedAt,
                updatedAt: input.requestedAt,
            },
        }));

        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 1,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [{
                            slotId: "slot-1",
                            index: 0,
                            category: "behavioral" as const,
                            questionText: "Tell me about a time you prioritized similar work.",
                        }],
                    },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "I would ask a clarifying question first.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                            answerAttemptId: "attempt-1",
                            attemptNumber: 1,
                            trigger: "initial_submit" as const,
                            supersedesAnswerAttemptId: null,
                        },
                    },
                })),
            },
            requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun,
                completeEvaluationRun: vi.fn(async () => null),
                failEvaluationRun: vi.fn(async () => null),
            },
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: (request) => createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint,
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "EVALUATION_RUN_IN_PROGRESS",
            error: "Candidate coaching is already being prepared.",
            retryable: true,
            analysisRecovery: {
                status: "answer_analysis_recovery",
                state: "pending",
                canRetryAnalysis: false,
                canContinueWithoutCoaching: false,
            },
        });
        expect(requestAnswerAnalysis).not.toHaveBeenCalled();
    });

    it("replays completed answer analysis with the same idempotency key and submitted answer payload", async () => {
        const analysisSnapshot = {
            status: "answer_analysis_provider_result" as const,
            provider: "candidate_v2_answer_evaluator" as const,
            analyzedAt: "2026-07-09T20:03:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            coachFeedback: {
                acknowledgement: "You named a practical first step.",
                observation: "The answer would be stronger with the result of your choice.",
                nextPracticeFocus: "Add what changed after you set the priority.",
            },
            evidence: [],
        };
        const responseBody = {
            status: "answer_analysis_saved",
            analysisSnapshot,
        };
        const requestAnswerAnalysis = vi.fn();

        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-analysis-key-1",
                },
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:03:30.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    candidatePracticeSessionId: "session-1",
                    candidateProfileId: "22222222-2222-4222-8222-222222222222",
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 7,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [],
                    },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "I would ask a clarifying question first.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                        },
                    },
                    answerIdempotencyRecords: {
                        "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1": {
                            recordKey: "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1",
                            operation: "answer_analysis" as const,
                            scope: "candidate_answer_analysis:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-analysis-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                                submittedAt: "2026-07-09T20:01:00.000Z",
                            },
                            status: "completed" as const,
                            requestedAt: "2026-07-09T20:02:00.000Z",
                            completedAt: "2026-07-09T20:03:00.000Z",
                            response: {
                                statusCode: 200,
                                body: responseBody,
                            },
                        },
                    },
                })),
            },
            requestAnswerAnalysis,
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(responseBody);
        expect(requestAnswerAnalysis).not.toHaveBeenCalled();
    });

    it("returns a retryable conflict when the same answer analysis is already in progress", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-analysis-key-1",
                },
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:03:30.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    candidatePracticeSessionId: "session-1",
                    candidateProfileId: "22222222-2222-4222-8222-222222222222",
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 7,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: null,
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "I would ask a clarifying question first.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                        },
                    },
                    answerIdempotencyRecords: {
                        "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1": {
                            recordKey: "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1",
                            operation: "answer_analysis" as const,
                            scope: "candidate_answer_analysis:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-analysis-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                                submittedAt: "2026-07-09T20:01:00.000Z",
                            },
                            status: "pending" as const,
                            requestedAt: "2026-07-09T20:02:00.000Z",
                        },
                    },
                })),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "REQUEST_IN_PROGRESS",
            error: "An identical answer analysis request is already in progress.",
            retryable: true,
            analysisRecovery: {
                status: "answer_analysis_recovery",
                state: "pending",
                canRetryAnalysis: false,
                canContinueWithoutCoaching: false,
            },
        });
    });

    it("returns a nonretryable conflict when an answer analysis key is reused with a different submitted answer", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-analysis-key-1",
                },
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:03:30.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    candidatePracticeSessionId: "session-1",
                    candidateProfileId: "22222222-2222-4222-8222-222222222222",
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 7,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: null,
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "This is a changed answer.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                        },
                    },
                    answerIdempotencyRecords: {
                        "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1": {
                            recordKey: "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1",
                            operation: "answer_analysis" as const,
                            scope: "candidate_answer_analysis:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-analysis-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                                submittedAt: "2026-07-09T20:01:00.000Z",
                            },
                            status: "completed" as const,
                            requestedAt: "2026-07-09T20:02:00.000Z",
                        },
                    },
                })),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "IDEMPOTENCY_MISMATCH",
            error: "Idempotency key cannot be reused with a different answer analysis payload.",
            retryable: false,
        });
    });

    it("repairs a missing candidate-safe projection from a completed internal run without another provider call", async () => {
        const providerRequest = createProviderRequest();
        const inputFingerprint = createFixtureEvidenceFirstEvaluationCase(providerRequest).inputFingerprint;
        const acceptedRun = await runFixtureEvidenceFirstEvaluator(providerRequest, { evaluationRunId: "run-completed" });
        const requestAnswerAnalysis = vi.fn();
        const completeEvaluationRun = vi.fn();
        const saveAnswerAnalysisSnapshot = vi.fn(async (input) => ({
            "slot-1": input.analysisSnapshot,
        }));

        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
                saveAnswerAnalysisSnapshot,
            },
            requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun: vi.fn(async (input) => ({
                    outcome: "replayed" as const,
                    run: createEvaluationRunRecord({
                        ...input,
                        candidateAnswerEvaluationRunId: "run-completed",
                        lifecycleState: "completed",
                        result: acceptedRun,
                        validation: { disposition: "accepted" },
                        completedAt: acceptedRun.completedAt,
                    }),
                })),
                completeEvaluationRun,
                failEvaluationRun: vi.fn(),
            },
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: () => inputFingerprint,
            },
        });

        expect(response.status).toBe(200);
        expect(requestAnswerAnalysis).not.toHaveBeenCalled();
        expect(completeEvaluationRun).not.toHaveBeenCalled();
        expect(saveAnswerAnalysisSnapshot).toHaveBeenCalledOnce();
        expect(saveAnswerAnalysisSnapshot.mock.calls[0][0].analysisSnapshot.evidenceFirst).not.toHaveProperty("feedbackPlan");
    });

    it("restores accepted coaching when no provider runtime is currently configured", async () => {
        const providerRequest = createProviderRequest();
        const acceptedRun = await runFixtureEvidenceFirstEvaluator(providerRequest, {
            evaluationRunId: "run-completed-without-runtime",
        });
        const saveAnswerAnalysisSnapshot = vi.fn(async (input) => ({
            "slot-1": input.analysisSnapshot,
        }));
        const claimEvaluationRun = vi.fn(async () => null);

        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
                saveAnswerAnalysisSnapshot,
            },
            evaluationRunRepository: {
                listEvaluationRuns: vi.fn(async () => [createEvaluationRunRecord({
                    candidateAnswerEvaluationRunId: "run-completed-without-runtime",
                    candidateAnswerAttemptId: providerRequest.answer.answerAttemptId!,
                    purpose: "candidate_coaching",
                    ...candidateAnswerAnalysisFixtureRunMetadata,
                    inputFingerprint: acceptedRun.inputFingerprint,
                    idempotencyKey: "prior-analysis-key",
                    requestedAt: acceptedRun.requestedAt,
                    claimExpiresAt: "2026-07-09T20:03:00.000Z",
                    lifecycleState: "completed",
                    result: acceptedRun,
                    validation: { disposition: "accepted", candidateSafeProjection: true },
                    completedAt: acceptedRun.completedAt,
                })]),
                claimEvaluationRun,
                completeEvaluationRun: vi.fn(async () => null),
                failEvaluationRun: vi.fn(async () => null),
            },
        });

        expect(response.status).toBe(200);
        expect(claimEvaluationRun).not.toHaveBeenCalled();
        expect(saveAnswerAnalysisSnapshot).toHaveBeenCalledOnce();
    });

    it("does not project a provider result when the evaluator completion fence rejects it", async () => {
        const saveAnswerAnalysisSnapshot = vi.fn();
        const failEvaluationRun = vi.fn(async () => null);
        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
                saveAnswerAnalysisSnapshot,
            },
            requestAnswerAnalysis: (request, context) => runFixtureEvidenceFirstEvaluator(request, {
                evaluationRunId: context?.evaluationRunId,
            }),
            evaluationRunRepository: {
                claimEvaluationRun: vi.fn(async (input) => ({
                    outcome: "created" as const,
                    run: createEvaluationRunRecord({
                        ...input,
                        candidateAnswerEvaluationRunId: "run-expired-before-completion",
                    }),
                })),
                completeEvaluationRun: vi.fn(async () => null),
                failEvaluationRun,
            },
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: (request) => createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint,
            },
        });

        expect(response.status).toBe(503);
        expect(saveAnswerAnalysisSnapshot).not.toHaveBeenCalled();
        expect(failEvaluationRun).toHaveBeenCalledWith(expect.objectContaining({
            candidateAnswerEvaluationRunId: "run-expired-before-completion",
            errorCode: "CANDIDATE_COACHING_PROVIDER_FAILED",
        }));
    });

    it("allows one provider call when concurrent requests contend for the same evaluator claim", async () => {
        let activeRun: ReturnType<typeof createEvaluationRunRecord> | null = null;
        let releaseProvider: () => void = () => {
            throw new Error("Provider was not started.");
        };
        const requestAnswerAnalysis = vi.fn((request, context) => new Promise((resolve) => {
            releaseProvider = () => {
                void runFixtureEvidenceFirstEvaluator(request, {
                    evaluationRunId: context?.evaluationRunId,
                }).then(resolve);
            };
        }));
        const saveAnswerAnalysisSnapshot = vi.fn(async (input) => ({ "slot-1": input.analysisSnapshot }));
        const saveAnswerIdempotencyRecord = vi.fn(async () => ({}));
        const clearAnswerIdempotencyRecord = vi.fn(async () => ({}));
        const claimEvaluationRun = vi.fn(async (input) => {
            if (!activeRun) {
                activeRun = createEvaluationRunRecord({
                    ...input,
                    candidateAnswerEvaluationRunId: "run-concurrent",
                });
                return { outcome: "created" as const, run: activeRun };
            }
            return { outcome: "replayed" as const, run: activeRun };
        });
        const completeEvaluationRun = vi.fn(async (input) => {
            activeRun = {
                ...activeRun!,
                lifecycleState: "completed" as const,
                result: input.result,
                validation: input.validation,
                completedAt: input.completedAt,
                updatedAt: input.completedAt,
            };
            return activeRun;
        });
        const dependencies = {
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
                saveAnswerAnalysisSnapshot,
                saveAnswerIdempotencyRecord,
                clearAnswerIdempotencyRecord,
            },
            requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun,
                completeEvaluationRun,
                failEvaluationRun: vi.fn(),
            },
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: (request: CandidateAnswerAnalysisProviderRequest) => (
                    createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint
                ),
            },
        };

        const firstResponse = handleCandidateAnswerAnalysisRequest({ ...createHandlerInput(), ...dependencies });
        await vi.waitFor(() => expect(requestAnswerAnalysis).toHaveBeenCalledOnce());
        const secondResponse = await handleCandidateAnswerAnalysisRequest({ ...createHandlerInput(), ...dependencies });

        expect(secondResponse.status).toBe(409);
        await expect(secondResponse.json()).resolves.toMatchObject({ code: "EVALUATION_RUN_IN_PROGRESS" });
        expect(requestAnswerAnalysis).toHaveBeenCalledOnce();

        releaseProvider();
        expect((await firstResponse).status).toBe(200);
        expect(saveAnswerAnalysisSnapshot).toHaveBeenCalledOnce();
        expect(saveAnswerIdempotencyRecord).toHaveBeenCalledTimes(3);
        expect(clearAnswerIdempotencyRecord).not.toHaveBeenCalled();
    });

    it("creates a new evaluator generation for analysis-only recovery without creating another answer attempt", async () => {
        const runtime = createCandidateAnswerAnalysisDevelopmentRuntime({
            explicitLocalDev: true,
            env: {
                NODE_ENV: "development",
                CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fault",
                CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE: "provider_5xx_once",
            },
        })!;
        const runs: Array<ReturnType<typeof createEvaluationRunRecord>> = [];
        const claimEvaluationRun = vi.fn(async (input) => {
            const current = runs.at(-1);
            if (current?.lifecycleState === "requested" || current?.lifecycleState === "completed") {
                return { outcome: "replayed" as const, run: current };
            }
            const run = createEvaluationRunRecord({
                ...input,
                candidateAnswerEvaluationRunId: `run-generation-${runs.length + 1}`,
                generationAttempt: runs.length + 1,
            });
            runs.push(run);
            return { outcome: "created" as const, run };
        });
        const failEvaluationRun = vi.fn(async (input) => {
            const run = runs.find((candidateRun) => (
                candidateRun.candidateAnswerEvaluationRunId === input.candidateAnswerEvaluationRunId
            ));
            if (!run || run.lifecycleState !== "requested") return null;
            Object.assign(run, {
                lifecycleState: input.lifecycleState,
                errorCode: input.errorCode,
                validation: input.validation ?? null,
                completedAt: input.completedAt,
                updatedAt: input.completedAt,
            });
            return run;
        });
        const completeEvaluationRun = vi.fn(async (input) => {
            const run = runs.find((candidateRun) => (
                candidateRun.candidateAnswerEvaluationRunId === input.candidateAnswerEvaluationRunId
            ));
            if (!run || run.lifecycleState !== "requested") return null;
            Object.assign(run, {
                lifecycleState: "completed",
                result: input.result,
                validation: input.validation,
                completedAt: input.completedAt,
                updatedAt: input.completedAt,
            });
            return run;
        });
        const saveAnswerAnalysisSnapshot = vi.fn(async (input) => ({ "slot-1": input.analysisSnapshot }));
        const dependencies = {
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
                saveAnswerAnalysisSnapshot,
            },
            requestAnswerAnalysis: runtime.requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun,
                completeEvaluationRun,
                failEvaluationRun,
            },
            evaluationRunConfiguration: {
                ...runtime.runMetadata,
                createInputFingerprint: runtime.createInputFingerprint,
            },
        };

        const failed = await handleCandidateAnswerAnalysisRequest({ ...createHandlerInput(), ...dependencies });
        const recovered = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            now: new Date("2026-07-16T20:03:00.000Z"),
            ...dependencies,
        });

        expect(failed.status).toBe(503);
        expect(recovered.status).toBe(200);
        expect(runs).toMatchObject([
            { generationAttempt: 1, lifecycleState: "failed", candidateAnswerAttemptId: "attempt-1" },
            { generationAttempt: 2, lifecycleState: "completed", candidateAnswerAttemptId: "attempt-1" },
        ]);
        expect(saveAnswerAnalysisSnapshot).toHaveBeenCalledOnce();
    });

    it("assembles the Google runtime only from the exact server provider/profile/key contract", () => {
        const transport = createGoogleTransport([]);
        const transportFactory = vi.fn(() => transport);
        const dependencies = createDefaultCandidateAnswerAnalysisDependencies({
            env: {
                DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable",
                CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
                CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
                GEMINI_API_KEY: "server-only-key",
            },
            googleTransportFactory: transportFactory,
        });

        expect(transportFactory).toHaveBeenCalledWith("server-only-key");
        expect(dependencies.requestAnswerAnalysis).toBeTypeOf("function");
        expect(dependencies.evaluationRunRepository).toBeDefined();
        expect(dependencies.evaluationRunConfiguration).toMatchObject({
            provider: "candidate_v2_evidence_first_pipeline",
            modelName: "google_gemini_2_5_flash_v1",
            configurationManifest: {
                configurationStatus: "resolved",
                serviceMode: "gemini_api",
            },
        });
        expect(JSON.stringify(dependencies)).not.toContain("server-only-key");
    });

    it.each([
        [{
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable",
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
            CANDIDATE_ANSWER_ANALYSIS_PROFILE: "wrong-profile",
            GEMINI_API_KEY: "server-only-key",
        }],
        [{
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable",
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
            CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
        }],
    ])("fails closed without assembling provider work for invalid Google configuration", (env) => {
        const transportFactory = vi.fn(() => createGoogleTransport([]));
        const dependencies = createDefaultCandidateAnswerAnalysisDependencies({
            env,
            googleTransportFactory: transportFactory,
        });

        expect(dependencies.requestAnswerAnalysis).toBeUndefined();
        expect(dependencies.evaluationRunRepository).toBeDefined();
        expect(dependencies.evaluationRunConfiguration).toBeUndefined();
        expect(transportFactory).not.toHaveBeenCalled();
    });

    it("performs zero Google transport or evaluator-claim work before candidate ownership succeeds", async () => {
        const transport = createGoogleTransport([]);
        const runtime = createGoogleRouteRuntime(transport);
        const claimEvaluationRun = vi.fn();
        const findSetupSession = vi.fn();

        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            resolveCandidateSessionIdentity: vi.fn(async () => null),
            practiceSessionRepository: { findSetupSession },
            requestAnswerAnalysis: runtime.requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun,
                completeEvaluationRun: vi.fn(),
                failEvaluationRun: vi.fn(),
            },
            evaluationRunConfiguration: {
                ...runtime.runMetadata,
                createInputFingerprint: runtime.createInputFingerprint,
            },
        });

        expect(response.status).toBe(401);
        expect(findSetupSession).not.toHaveBeenCalled();
        expect(claimEvaluationRun).not.toHaveBeenCalled();
        expect(transport.calls).toHaveLength(0);
    });

    it("runs the conformed Google stages only after claim and persists the accepted run before projection", async () => {
        const providerRequest = createGoogleProviderRequest();
        const fixtureRun = await runFixtureEvidenceFirstEvaluator(providerRequest);
        const sequence: string[] = [];
        const transport = createGoogleTransport([
            providerResponse(fixtureRun.accepted.extraction),
            providerResponse(fixtureRun.accepted.feedback),
        ], sequence);
        const runtime = createGoogleRouteRuntime(transport);
        let claimedRun: ReturnType<typeof createEvaluationRunRecord> | null = null;
        const claimEvaluationRun = vi.fn(async (input) => {
            sequence.push("claim");
            claimedRun = createEvaluationRunRecord({
                ...input,
                candidateAnswerEvaluationRunId: "google-run-1",
            });
            return { outcome: "created" as const, run: claimedRun };
        });
        const completeEvaluationRun = vi.fn(async (input) => {
            sequence.push("complete");
            return claimedRun ? {
                ...claimedRun,
                lifecycleState: "completed" as const,
                result: input.result,
                validation: input.validation,
                completedAt: input.completedAt,
                updatedAt: input.completedAt,
            } : null;
        });
        const saveAnswerAnalysisSnapshot = vi.fn(async (input) => {
            sequence.push("projection");
            return { "slot-1": input.analysisSnapshot };
        });

        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
                saveAnswerAnalysisSnapshot,
            },
            requestAnswerAnalysis: runtime.requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun,
                completeEvaluationRun,
                failEvaluationRun: vi.fn(),
            },
            evaluationRunConfiguration: {
                ...runtime.runMetadata,
                createInputFingerprint: runtime.createInputFingerprint,
            },
        });

        expect(response.status).toBe(200);
        expect(sequence).toEqual(["claim", "provider", "provider", "complete", "projection"]);
        expect(claimEvaluationRun).toHaveBeenCalledWith(expect.objectContaining({
            provider: "candidate_v2_evidence_first_pipeline",
            modelName: "google_gemini_2_5_flash_v1",
            configurationManifest: runtime.runMetadata.configurationManifest,
            configurationFingerprint: runtime.runMetadata.configurationFingerprint,
        }));
        expect(completeEvaluationRun).toHaveBeenCalledWith(expect.objectContaining({
            candidateAnswerEvaluationRunId: "google-run-1",
            result: expect.objectContaining({
                status: "evidence_first_evaluator_run_accepted",
                evaluationRunId: "google-run-1",
            }),
        }));
        expect(saveAnswerAnalysisSnapshot).toHaveBeenCalledOnce();
        expect(transport.calls).toHaveLength(2);
    });

    it("does not call Google when a fresh evaluator claim is replayed", async () => {
        const transport = createGoogleTransport([]);
        const runtime = createGoogleRouteRuntime(transport);
        const claimEvaluationRun = vi.fn(async (input) => ({
            outcome: "replayed" as const,
            run: createEvaluationRunRecord({
                ...input,
                candidateAnswerEvaluationRunId: "google-run-pending",
            }),
        }));

        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
            },
            requestAnswerAnalysis: runtime.requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun,
                completeEvaluationRun: vi.fn(),
                failEvaluationRun: vi.fn(),
            },
            evaluationRunConfiguration: {
                ...runtime.runMetadata,
                createInputFingerprint: runtime.createInputFingerprint,
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            code: "EVALUATION_RUN_IN_PROGRESS",
            analysisRecovery: { state: "pending", canContinueWithoutCoaching: false },
        });
        expect(transport.calls).toHaveLength(0);
    });

    it("refuses a fourth candidate-coaching generation in ten minutes without provider work", async () => {
        const requestAnswerAnalysis = vi.fn();
        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
            },
            requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun: vi.fn(async (input) => ({
                    outcome: "generation_limit" as const,
                    recentGenerationCount: 3,
                    run: createEvaluationRunRecord({
                        ...input,
                        candidateAnswerEvaluationRunId: "capped-run-3",
                        generationAttempt: 3,
                        lifecycleState: "failed",
                        validation: { retryableByNewRun: true },
                        errorCode: "GOOGLE_PROVIDER_UNAVAILABLE",
                        completedAt: "2026-07-16T20:01:30.000Z",
                    }),
                })),
                completeEvaluationRun: vi.fn(),
                failEvaluationRun: vi.fn(),
            },
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: (request) => createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint,
            },
        });

        expect(response.status).toBe(429);
        await expect(response.json()).resolves.toEqual({
            code: "ANSWER_ANALYSIS_RECOVERY_LIMIT",
            error: "Candidate coaching is unavailable for this answer right now.",
            retryable: false,
            analysisRecovery: {
                status: "answer_analysis_recovery",
                state: "unavailable",
                canRetryAnalysis: false,
                canContinueWithoutCoaching: true,
            },
        });
        expect(requestAnswerAnalysis).not.toHaveBeenCalled();
    });

    it("refuses a new generation after a terminal nonretryable outcome", async () => {
        const requestAnswerAnalysis = vi.fn();
        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
            },
            requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun: vi.fn(async (input) => ({
                    outcome: "generation_unavailable" as const,
                    recentGenerationCount: 1,
                    run: createEvaluationRunRecord({
                        ...input,
                        candidateAnswerEvaluationRunId: "rejected-run-1",
                        lifecycleState: "rejected",
                        validation: { retryableByNewRun: false },
                        errorCode: "PROVIDER_SAFETY_BLOCKED",
                        completedAt: "2026-07-16T20:01:30.000Z",
                    }),
                })),
                completeEvaluationRun: vi.fn(),
                failEvaluationRun: vi.fn(),
            },
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: (request) => createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint,
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "ANSWER_ANALYSIS_UNAVAILABLE",
            error: "Candidate coaching is unavailable for this answer right now.",
            retryable: false,
            analysisRecovery: {
                status: "answer_analysis_recovery",
                state: "unavailable",
                canRetryAnalysis: false,
                canContinueWithoutCoaching: true,
            },
        });
        expect(requestAnswerAnalysis).not.toHaveBeenCalled();
    });

    it("makes a nonretryable evaluator rejection continue-only without leaking its cause", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
            },
            requestAnswerAnalysis: vi.fn(async () => {
                throw new EvidenceFirstEvaluatorRuntimeError({
                    disposition: "rejected",
                    errorCode: "PROVIDER_SAFETY_BLOCKED",
                    stage: "evidence_extraction",
                    retryableByNewRun: false,
                    attempts: [],
                });
            }),
            evaluationRunRepository: {
                claimEvaluationRun: vi.fn(async (input) => ({
                    outcome: "created" as const,
                    recentGenerationCount: 1,
                    run: createEvaluationRunRecord({
                        ...input,
                        candidateAnswerEvaluationRunId: "rejected-run-1",
                    }),
                })),
                completeEvaluationRun: vi.fn(),
                failEvaluationRun: vi.fn(async () => null),
            },
            evaluationRunConfiguration: {
                ...candidateAnswerAnalysisFixtureRunMetadata,
                createInputFingerprint: (request) => createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint,
            },
        });
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toEqual({
            code: "ANSWER_ANALYSIS_FAILED",
            error: "Candidate coaching could not be prepared.",
            retryable: false,
            analysisRecovery: {
                status: "answer_analysis_recovery",
                state: "unavailable",
                canRetryAnalysis: false,
                canContinueWithoutCoaching: true,
            },
        });
        expect(JSON.stringify(body)).not.toContain("PROVIDER_SAFETY_BLOCKED");
    });

    it("terminalizes a Google transport failure with safe metadata and no provider-detail leakage", async () => {
        const calls: GenerateContentParameters[] = [];
        const transport: GoogleEvidenceFirstTransport = {
            async generateContent(input) {
                calls.push(input);
                throw { status: 503, message: "provider-secret-response-body" };
            },
        };
        const runtime = createGoogleRouteRuntime(transport);
        const failEvaluationRun = vi.fn(async () => null);
        const saveAnswerAnalysisSnapshot = vi.fn();

        const response = await handleCandidateAnswerAnalysisRequest({
            ...createHandlerInput(),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createOwnedAnalysisSession()),
                saveAnswerAnalysisSnapshot,
            },
            requestAnswerAnalysis: runtime.requestAnswerAnalysis,
            evaluationRunRepository: {
                claimEvaluationRun: vi.fn(async (input) => ({
                    outcome: "created" as const,
                    run: createEvaluationRunRecord({
                        ...input,
                        candidateAnswerEvaluationRunId: "google-run-failed",
                    }),
                })),
                completeEvaluationRun: vi.fn(),
                failEvaluationRun,
            },
            evaluationRunConfiguration: {
                ...runtime.runMetadata,
                createInputFingerprint: runtime.createInputFingerprint,
            },
        });
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toEqual({
            code: "ANSWER_ANALYSIS_FAILED",
            error: "Candidate coaching could not be prepared.",
            retryable: true,
            analysisRecovery: {
                status: "answer_analysis_recovery",
                state: "retryable",
                canRetryAnalysis: true,
                canContinueWithoutCoaching: true,
            },
        });
        expect(JSON.stringify(body)).not.toContain("provider-secret-response-body");
        expect(calls).toHaveLength(2);
        expect(failEvaluationRun).toHaveBeenCalledWith(expect.objectContaining({
            candidateAnswerEvaluationRunId: "google-run-failed",
            lifecycleState: "failed",
            errorCode: "GOOGLE_PROVIDER_UNAVAILABLE",
            validation: expect.objectContaining({
                disposition: "failed",
                stage: "evidence_extraction",
                attemptCount: 2,
            }),
        }));
        expect(saveAnswerAnalysisSnapshot).not.toHaveBeenCalled();
    });
});

function createHandlerInput() {
    return {
        request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
            method: "POST",
        }),
        sessionId: "session-1",
        slotId: "slot-1",
        now: new Date("2026-07-16T20:02:00.000Z"),
        resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
    };
}

function createOwnedAnalysisSession() {
    return {
        setupSnapshot: {
            targetRole: "Quality Control Inspector",
            jobDescription: "Inspect finished packaging and verify labels.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 5,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-16T20:00:00.000Z",
        },
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [{
                slotId: "slot-1",
                index: 0,
                category: "behavioral" as const,
                questionText: "Tell me about a time you checked important work.",
            }],
        },
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text" as const,
                text: "I checked the work order, inspected the label, and documented the result.",
                submittedAt: "2026-07-16T20:01:00.000Z",
                status: "pending_analysis" as const,
                answerAttemptId: "attempt-1",
                attemptNumber: 1,
                trigger: "initial_submit" as const,
                supersedesAnswerAttemptId: null,
            },
        },
        answerIdempotencyRecords: {},
    };
}

function createProviderRequest() {
    return {
        status: "answer_analysis_provider_requested" as const,
        provider: "candidate_v2_answer_evaluator" as const,
        requestedAt: "2026-07-16T20:02:00.000Z",
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text" as const,
            text: "I checked the work order, inspected the label, and documented the result.",
            submittedAt: "2026-07-16T20:01:00.000Z",
            answerAttemptId: "attempt-1",
            attemptNumber: 1,
            trigger: "initial_submit" as const,
        },
        question: {
            slotId: "slot-1",
            questionIndex: 0,
            category: "behavioral" as const,
            questionText: "Tell me about a time you checked important work.",
            plannedPurpose: candidateQuestionPlanCategoryDetails.behavioral.purpose,
        },
        setupContext: {
            targetRole: "Quality Control Inspector",
            jobDescription: "Inspect finished packaging and verify labels.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 5,
        },
    };
}

function createGoogleProviderRequest(): CandidateAnswerAnalysisProviderRequest {
    return {
        ...createProviderRequest(),
        question: {
            ...createProviderRequest().question,
            plannedPurpose: candidateQuestionPlanCategoryDetails.behavioral.purpose,
        },
    };
}

function createGoogleRouteRuntime(transport: GoogleEvidenceFirstTransport) {
    return createCandidateAnswerAnalysisGoogleRuntime({
        env: {
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
            CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
            GEMINI_API_KEY: "test-route-key",
        },
        transportFactory: () => transport,
    })!;
}

function createGoogleTransport(
    responses: GenerateContentResponse[],
    sequence?: string[],
): GoogleEvidenceFirstTransport & { calls: GenerateContentParameters[] } {
    const calls: GenerateContentParameters[] = [];
    return {
        calls,
        async generateContent(input) {
            sequence?.push("provider");
            calls.push(input);
            const response = responses.shift();
            if (!response) throw new Error("Unexpected mocked Google transport call.");
            return response;
        },
    };
}

function providerResponse(value: unknown) {
    return {
        text: JSON.stringify(value),
        candidates: [{ finishReason: "STOP" }],
    } as unknown as GenerateContentResponse;
}

function createEvaluationRunRecord(input: {
    candidateAnswerEvaluationRunId: string;
    candidateAnswerAttemptId: string;
    purpose: "candidate_coaching";
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    configurationManifest: EvidenceFirstEvaluatorResolvedConfigurationManifest;
    configurationFingerprint: string;
    inputFingerprint: string;
    idempotencyKey: string;
    requestedAt: string;
    claimExpiresAt: string;
    generationAttempt?: number;
    lifecycleState?: "requested" | "completed" | "failed" | "rejected";
    result?: Record<string, unknown> | null;
    validation?: Record<string, unknown> | null;
    errorCode?: string | null;
    completedAt?: string | null;
}) {
    return {
        candidateAnswerEvaluationRunId: input.candidateAnswerEvaluationRunId,
        candidateAnswerAttemptId: input.candidateAnswerAttemptId,
        purpose: input.purpose,
        provider: input.provider,
        modelName: input.modelName,
        promptVersion: input.promptVersion,
        evaluatorVersion: input.evaluatorVersion,
        configurationManifest: input.configurationManifest,
        configurationFingerprint: input.configurationFingerprint,
        inputFingerprint: input.inputFingerprint,
        idempotencyKey: input.idempotencyKey,
        generationAttempt: input.generationAttempt ?? 1,
        lifecycleState: input.lifecycleState ?? "requested" as const,
        result: input.result ?? null,
        validation: input.validation ?? null,
        errorCode: input.errorCode ?? null,
        requestedAt: input.requestedAt,
        claimExpiresAt: input.claimExpiresAt,
        completedAt: input.completedAt ?? null,
        createdAt: input.requestedAt,
        updatedAt: input.completedAt ?? input.requestedAt,
    };
}
