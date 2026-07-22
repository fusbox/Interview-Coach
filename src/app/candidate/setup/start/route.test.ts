import { describe, expect, it, vi } from "vitest";

import { handleCandidateSetupStartRequest, resolveCandidateSetupIdentityFromDevLaunchCookie, POST } from "./route-implementation";
import {
    createFaultInjectionCandidateQuestionWordingRuntime,
    createFixtureCandidateQuestionWordingRuntime,
} from "@/features/candidate-session-v2/candidate-question-wording-runtime";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";

const setupStartIdempotencyKey = "setup-start-route-test-key";

function createAcquiredSetupStartRequestRepository() {
    return {
        claimSetupStart: vi.fn(async (input: {
            idempotencyKeyHash: string;
            requestFingerprint: string;
        }) => ({
            outcome: "acquired" as const,
            idempotencyKeyHash: input.idempotencyKeyHash,
            requestFingerprint: input.requestFingerprint,
            claimGeneration: 1,
        })),
        failSetupStart: vi.fn(async () => true),
    };
}

describe("/candidate/setup/start route", () => {
    it("resolves explicit dev host-launch fixture cookies without candidate launch-session storage", async () => {
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        await expect(resolveCandidateSetupIdentityFromDevLaunchCookie(
            new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                headers: {
                    Cookie: "ic_candidate_launch_session=dev-host-launch-100001",
                },
            }),
        )).resolves.toEqual({
            candidateProfileId: "10000000-0000-4000-8000-000000000001",
            setupOwnerKey: "candidate:10000000-0000-4000-8000-000000000001",
            candidateLaunchSessionId: null,
            trustedSetupContext: null,
            allowManualPrepContextCreation: true,
            allowBrowserBridgeFallback: true,
        });
    });

    it("creates a provisional session transition from valid setup input", async () => {
        const response = await POST(new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
            method: "POST",
            body: JSON.stringify({
                targetRole: "Customer service representative",
                jobDescription: "Help customers resolve service questions.",
                resumeText: "",
                interviewStage: "first_interview",
                questionCount: 7,
            }),
        }));

        await expect(response.json()).resolves.toMatchObject({
            status: "session_created",
            sessionId: expect.any(String),
            nextRoute: expect.stringMatching(/^\/candidate\/session\/.+/),
            setupSnapshot: {
                targetRole: "Customer service representative",
                jobDescription: "Help customers resolve service questions.",
                resumeText: null,
                interviewStage: "first_interview",
                questionCount: 7,
                resumeCaptureMode: "none",
            },
            questionPlanSnapshot: {
                interviewStage: "first_interview",
                questionCount: 7,
                categoryCounts: {
                    screening: 2,
                    behavioral: 2,
                    culture_fit: 1,
                    case_scenario: 1,
                    technical_role_specific: 1,
                },
                slots: expect.arrayContaining([
                    expect.objectContaining({ id: "slot-1", category: "screening" }),
                    expect.objectContaining({ id: "slot-7", category: "behavioral" }),
                ]),
            },
            questionWordingSnapshot: {
                status: "questions_worded",
                questions: expect.arrayContaining([
                    expect.objectContaining({
                        slotId: "slot-1",
                        index: 0,
                        category: "screening",
                        questionText: "What interests you about this Customer service representative role?",
                    }),
                    expect.objectContaining({
                        slotId: "slot-2",
                        index: 1,
                        category: "behavioral",
                    }),
                ]),
            },
        });
        expect(response.status).toBe(201);
    });

    it("rejects invalid setup input", async () => {
        const response = await POST(new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
            method: "POST",
            body: JSON.stringify({
                targetRole: "",
                jobDescription: "",
                interviewStage: "first_interview",
                questionCount: 7,
            }),
        }));

        await expect(response.json()).resolves.toEqual({
            error: "Invalid setup request.",
            fieldErrors: {
                jobDescription: ["Job description is required."],
                targetRole: ["Target role is required."],
            },
        });
        expect(response.status).toBe(400);
    });

    it("returns setup field errors for payloads that fail the setup contract", async () => {
        const response = await POST(new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
            method: "POST",
            body: JSON.stringify({
                targetRole: "Material handler",
                jobDescription: "a".repeat(12_001),
                interviewStage: "first_interview",
                questionCount: 7,
            }),
        }));

        await expect(response.json()).resolves.toEqual({
            error: "Invalid setup request.",
            fieldErrors: {
                jobDescription: ["Job description must be 12,000 characters or fewer."],
            },
        });
        expect(response.status).toBe(400);
    });

    it("rejects raw resume text for an identity-backed production setup before prep or wording work", async () => {
        const resolveSetupPrepContext = vi.fn();
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and track production materials.",
                    resumeText: "Call me at 312-555-0199.",
                    interviewStage: "screening",
                    questionCount: 5,
                }),
            }),
            now: new Date("2026-07-21T12:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            practiceSessionRepository: { createSetupSession: vi.fn() },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Review and accept the processed resume text before starting practice.",
            code: "RESUME_REVIEW_REQUIRED",
        });
        expect(resolveSetupPrepContext).not.toHaveBeenCalled();
    });

    it("reloads exact accepted candidate-owned resume text before setup planning", async () => {
        const canonicalResumeText = "Inventory lead with shipping and cycle-count experience.";
        const resolveAcceptedSelection = vi.fn(async () => ({
            artifactId: "20000000-0000-4000-8000-000000000001",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            roleProfileId: null,
            version: 1,
            revision: 2,
            source: "document_upload" as const,
            candidateLabel: "resume.pdf",
            normalizedText: canonicalResumeText,
            sourceFingerprint: "a".repeat(64),
            normalizedTextFingerprint: "b".repeat(64),
            processingPolicyVersion: "candidate_resume_text_processing_v1",
            piiPolicyVersion: "candidate_resume_direct_pii_v5",
            piiRedactionCounts: {
                known_name: 0,
                personal_detail: 0,
                email: 1,
                phone: 0,
                address: 0,
                date_of_birth: 0,
                government_identifier: 0,
                personal_url_or_handle: 0,
            },
            reviewState: "accepted" as const,
            createdAt: "2026-07-21T11:55:00.000Z",
            acceptedAt: "2026-07-21T11:56:00.000Z",
            originalRetained: false as const,
        }));
        const resolveSetupPrepContext = vi.fn(async () => ({
            status: "resolved" as const,
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            resolution: "created" as const,
        }));
        const createSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }));
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and track production materials.",
                    resumeText: "tampered browser text",
                    resumeArtifact: {
                        artifactId: "20000000-0000-4000-8000-000000000001",
                        version: 1,
                        revision: 2,
                        source: "document_upload",
                        candidateLabel: "resume.pdf",
                        reviewState: "accepted",
                    },
                    interviewStage: "screening",
                    questionCount: 5,
                }),
            }),
            now: new Date("2026-07-21T12:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                setupOwnerKey: "candidate:22222222-2222-4222-8222-222222222222",
                allowManualPrepContextCreation: true,
            })),
            resumeSelectionRepository: {
                resolveAcceptedSelection,
                clearSelection: vi.fn(async () => ({ revision: 1 })),
            },
            prepContextResolver: { resolveSetupPrepContext },
            practiceSessionRepository: { createSetupSession },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
        });

        expect(response.status).toBe(201);
        expect(resolveAcceptedSelection).toHaveBeenCalledWith({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            setupOwnerKey: "candidate:22222222-2222-4222-8222-222222222222",
            artifactId: "20000000-0000-4000-8000-000000000001",
            version: 1,
            revision: 2,
        });
        expect(createSetupSession).toHaveBeenCalledWith(expect.objectContaining({
            resumeSelectionOwnerKey: "candidate:22222222-2222-4222-8222-222222222222",
            setupSnapshot: expect.objectContaining({
                resumeText: canonicalResumeText,
                resumeArtifact: expect.objectContaining({
                    artifactId: "20000000-0000-4000-8000-000000000001",
                    source: "document_upload",
                    reviewState: "accepted",
                }),
            }),
        }));
    });

    it("persists the setup-created session when candidate identity dependencies resolve", async () => {
        const resolveSetupPrepContext = vi.fn(async () => ({
            status: "resolved" as const,
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            resolution: "created" as const,
        }));
        const createSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }));

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: {
                    Cookie: "ic_candidate_launch_session=launch-session-123",
                    "Idempotency-Key": setupStartIdempotencyKey,
                },
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    resumeText: "",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-09T16:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                candidateLaunchSessionId: "launch-session-123",
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: {
                resolveSetupPrepContext,
            },
            practiceSessionRepository: {
                createSetupSession,
            },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
        });

        await expect(response.json()).resolves.toMatchObject({
            status: "session_created",
            sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            nextRoute: "/candidate/session/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            setupSnapshot: {
                targetRole: "Customer service representative",
                createdAt: "2026-07-09T16:00:00.000Z",
            },
        });
        expect(response.status).toBe(201);
        expect(resolveSetupPrepContext).toHaveBeenCalledWith({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            requestedRoleProfileId: null,
            createSeparateFromRoleProfileId: null,
            allowManualCreation: true,
            trustedLaunchContext: null,
            trustedLaunchSessionId: null,
            setupSnapshot: expect.objectContaining({
                targetRole: "Customer service representative",
                jobDescription: "Help customers resolve service questions.",
            }),
        });
        expect(createSetupSession).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidateLaunchSessionId: "launch-session-123",
            consumeTrustedLaunchSetupContext: false,
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            setupSnapshot: expect.objectContaining({
                targetRole: "Customer service representative",
            }),
            questionPlanSnapshot: expect.objectContaining({
                questionCount: 7,
            }),
            questionWordingSnapshot: expect.objectContaining({
                status: "questions_worded",
            }),
            progress: {
                status: "planned",
                currentQuestionIndex: 0,
            },
        }));
    });

    it("replays one accepted candidate-owned session without prep resolution or another provider call", async () => {
        const candidateProfileId = "22222222-2222-4222-8222-222222222222";
        const candidatePracticeSessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        const setupSnapshot = {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-18T16:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: setupSnapshot.interviewStage,
            questionCount: setupSnapshot.questionCount,
        });
        const questionWordingSnapshot = createFixtureCandidateQuestionWordingResult({
            setupSnapshot,
            questionPlanSnapshot,
        });
        const resolveSetupPrepContext = vi.fn();
        const wordQuestions = vi.fn();

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: setupSnapshot.targetRole,
                    jobDescription: setupSnapshot.jobDescription,
                    interviewStage: setupSnapshot.interviewStage,
                    questionCount: setupSnapshot.questionCount,
                }),
            }),
            now: new Date("2026-07-18T16:05:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId,
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            setupStartRequestRepository: {
                claimSetupStart: vi.fn(async (input) => ({
                    outcome: "replayed" as const,
                    idempotencyKeyHash: input.idempotencyKeyHash,
                    requestFingerprint: input.requestFingerprint,
                    claimGeneration: 1,
                    candidatePracticeSessionId,
                })),
                failSetupStart: vi.fn(async () => true),
            },
            practiceSessionRepository: {
                createSetupSession: vi.fn(),
                findSetupSession: vi.fn(async () => ({
                    candidatePracticeSessionId,
                    candidateProfileId,
                    roleProfileId: "33333333-3333-4333-8333-333333333333",
                    candidateLaunchSessionId: null,
                    status: "planned" as const,
                    setupSnapshot,
                    questionPlanSnapshot,
                    questionWordingSnapshot,
                    questionWordingStatus: "worded" as const,
                    progress: { status: "planned" as const, currentQuestionIndex: 0 },
                    answerDrafts: {},
                    answerSubmissions: {},
                    answerIdempotencyRecords: {},
                    answerAnalysisSnapshots: {},
                    feedbackActionEvents: {},
                    completionSnapshot: null,
                })),
            },
            questionWordingRuntime: {
                ...createFixtureCandidateQuestionWordingRuntime(),
                wordQuestions,
            },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: "session_created",
            sessionId: candidatePracticeSessionId,
            nextRoute: `/candidate/session/${candidatePracticeSessionId}`,
        });
        expect(resolveSetupPrepContext).not.toHaveBeenCalled();
        expect(wordQuestions).not.toHaveBeenCalled();
    });

    it.each([
        ["in_progress", "SETUP_START_IN_PROGRESS"],
        ["conflict", "SETUP_START_IDEMPOTENCY_CONFLICT"],
    ] as const)("fails the %s duplicate before prep resolution and provider work", async (outcome, code) => {
        const resolveSetupPrepContext = vi.fn();
        const wordQuestions = vi.fn();
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and label materials.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-18T16:00:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            setupStartRequestRepository: {
                claimSetupStart: vi.fn(async (input) => ({
                    outcome,
                    idempotencyKeyHash: input.idempotencyKeyHash,
                    requestFingerprint: input.requestFingerprint,
                    claimGeneration: 1,
                })),
                failSetupStart: vi.fn(async () => true),
            },
            practiceSessionRepository: { createSetupSession: vi.fn() },
            questionWordingRuntime: {
                ...createFixtureCandidateQuestionWordingRuntime(),
                wordQuestions,
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ code, retryable: true });
        expect(resolveSetupPrepContext).not.toHaveBeenCalled();
        expect(wordQuestions).not.toHaveBeenCalled();
    });

    it("returns candidate-owned exact-match facts without creating a session", async () => {
        const createSetupSession = vi.fn();
        const resolveSetupPrepContext = vi.fn(async () => ({
            status: "existing_paths" as const,
            existingPrepContexts: [{
                roleProfileId: "33333333-3333-4333-8333-333333333333",
                targetRole: "Customer service representative",
                jobDescription: "Help customers resolve service questions.",
                interviewStage: "first_interview" as const,
                questionCount: 7,
                createdAt: "2026-07-01T15:00:00.000Z",
                lastPracticeActivityAt: "2026-07-14T15:00:00.000Z",
                completedSessionCount: 2,
                completedQuestionCount: 11,
                activeRound: {
                    completedQuestionCount: 2,
                    totalQuestionCount: 5,
                },
            }],
        }));

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-15T16:00:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            practiceSessionRepository: { createSetupSession },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
        });

        await expect(response.json()).resolves.toEqual({
            status: "existing_prep_context_found",
            existingPrepContexts: [expect.objectContaining({
                roleProfileId: "33333333-3333-4333-8333-333333333333",
                completedSessionCount: 2,
                completedQuestionCount: 11,
                activeRound: {
                    completedQuestionCount: 2,
                    totalQuestionCount: 5,
                },
            })],
        });
        expect(response.status).toBe(409);
        expect(createSetupSession).not.toHaveBeenCalled();
    });

    it("accepts canonical trusted job context and atomically consumes it with session creation", async () => {
        const trustedSetupContext = {
            sourcePlatform: "talentarbor" as const,
            jobCollectionId: "555",
            requirementId: "777",
            targetRole: "Warehouse Associate",
            jobDescription: "Pick, pack, and prepare shipments safely.",
            jobDescriptionHash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
        };
        const resolveSetupPrepContext = vi.fn(async () => ({
            status: "resolved" as const,
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            resolution: "created" as const,
        }));
        const createSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }));

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": setupStartIdempotencyKey,
                },
                body: JSON.stringify({
                    targetRole: "Warehouse Associate",
                    jobDescription: "Pick, pack, and prepare shipments safely.",
                    resumeText: null,
                    interviewStage: "screening",
                    questionCount: 5,
                    setupEntryMode: "trusted_host_job",
                }),
            }),
            now: new Date("2026-07-17T16:00:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                candidateLaunchSessionId: "launch-session-123",
                trustedSetupContext,
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            practiceSessionRepository: { createSetupSession },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
        });

        expect(response.status).toBe(201);
        expect(resolveSetupPrepContext).toHaveBeenCalledWith(expect.objectContaining({
            trustedLaunchContext: trustedSetupContext,
            trustedLaunchSessionId: "launch-session-123",
        }));
        expect(createSetupSession).toHaveBeenCalledWith(expect.objectContaining({
            candidateLaunchSessionId: "launch-session-123",
            consumeTrustedLaunchSetupContext: true,
            setupSnapshot: expect.objectContaining({
                targetRole: "Warehouse Associate",
                jobDescription: "Pick, pack, and prepare shipments safely.",
            }),
        }));
    });

    it("rejects browser mutation of a trusted host job before prep-context creation", async () => {
        const resolveSetupPrepContext = vi.fn();
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetRole: "Warehouse Associate",
                    jobDescription: "Browser-replaced job description.",
                    interviewStage: "screening",
                    questionCount: 5,
                    setupEntryMode: "trusted_host_job",
                }),
            }),
            now: new Date("2026-07-17T16:00:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                candidateLaunchSessionId: "launch-session-123",
                trustedSetupContext: {
                    sourcePlatform: "talentarbor" as const,
                    jobCollectionId: "555",
                    requirementId: "777",
                    targetRole: "Warehouse Associate",
                    jobDescription: "Pick, pack, and prepare shipments safely.",
                    jobDescriptionHash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
                },
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            practiceSessionRepository: { createSetupSession: vi.fn() },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Trusted job context changed before setup was submitted.",
        });
        expect(resolveSetupPrepContext).not.toHaveBeenCalled();
    });

    it("rejects a stale trusted-job submission after another tab consumed the context", async () => {
        const resolveSetupPrepContext = vi.fn();
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetRole: "Warehouse Associate",
                    jobDescription: "Pick, pack, and prepare shipments safely.",
                    interviewStage: "screening",
                    questionCount: 5,
                    setupEntryMode: "trusted_host_job",
                }),
            }),
            now: new Date("2026-07-17T16:00:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                candidateLaunchSessionId: "launch-session-123",
                trustedSetupContext: null,
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            practiceSessionRepository: { createSetupSession: vi.fn() },
        });

        expect(response.status).toBe(409);
        expect(resolveSetupPrepContext).not.toHaveBeenCalled();
    });

    it("consumes trusted setup staging when the candidate chooses its existing host-backed path", async () => {
        const consumeWithExistingPrepContext = vi.fn(async () => true);
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetRole: "Warehouse Associate",
                    jobDescription: "Pick, pack, and prepare shipments safely.",
                    interviewStage: "screening",
                    questionCount: 5,
                    setupEntryMode: "trusted_host_job",
                    prepContextDecision: {
                        action: "use_existing_path",
                        matchingRoleProfileId: "33333333-3333-4333-8333-333333333333",
                    },
                }),
            }),
            now: new Date("2026-07-17T16:00:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                candidateLaunchSessionId: "launch-session-123",
                trustedSetupContext: {
                    sourcePlatform: "talentarbor" as const,
                    jobCollectionId: "555",
                    requirementId: "777",
                    targetRole: "Warehouse Associate",
                    jobDescription: "Pick, pack, and prepare shipments safely.",
                    jobDescriptionHash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
                },
                allowManualPrepContextCreation: true,
            })),
            setupEntryRepository: { consumeWithExistingPrepContext },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "existing_prep_context_selected",
            nextRoute: "/candidate/dashboard?prep=33333333-3333-4333-8333-333333333333",
        });
        expect(consumeWithExistingPrepContext).toHaveBeenCalledWith({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            candidateLaunchSessionId: "launch-session-123",
            roleProfileId: "33333333-3333-4333-8333-333333333333",
        });
    });

    it("creates a separate profile and session only after an explicit exact-match choice", async () => {
        const resolveSetupPrepContext = vi.fn(async () => ({
            status: "resolved" as const,
            roleProfileId: "44444444-4444-4444-8444-444444444444",
            resolution: "separate_created" as const,
        }));
        const createSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }));

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                    prepContextDecision: {
                        action: "create_separate_path",
                        matchingRoleProfileId: "33333333-3333-4333-8333-333333333333",
                    },
                }),
            }),
            now: new Date("2026-07-15T16:00:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            practiceSessionRepository: { createSetupSession },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
        });

        expect(response.status).toBe(201);
        expect(resolveSetupPrepContext).toHaveBeenCalledWith(expect.objectContaining({
            createSeparateFromRoleProfileId: "33333333-3333-4333-8333-333333333333",
        }));
        expect(createSetupSession).toHaveBeenCalledWith(expect.objectContaining({
            roleProfileId: "44444444-4444-4444-8444-444444444444",
        }));
    });

    it("rejects malformed separate-path decisions before resolving identity", async () => {
        const resolveCandidateSetupIdentity = vi.fn();
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and label materials.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                    prepContextDecision: {
                        action: "reuse_without_confirmation",
                    },
                }),
            }),
            now: new Date("2026-07-15T16:00:00.000Z"),
            createSessionId: () => "unused-session-id",
            resolveCandidateSetupIdentity,
        });

        await expect(response.json()).resolves.toEqual({
            error: "Invalid preparation-context choice.",
        });
        expect(response.status).toBe(400);
        expect(resolveCandidateSetupIdentity).not.toHaveBeenCalled();
    });

    it("keeps the browser-bridge provisional response when candidate identity is unavailable", async () => {
        const createSetupSession = vi.fn();

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-09T16:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            allowBrowserBridgeWithoutIdentity: true,
            resolveCandidateSetupIdentity: vi.fn(async () => null),
            practiceSessionRepository: {
                createSetupSession,
            },
        });

        await expect(response.json()).resolves.toMatchObject({
            status: "session_created",
            sessionId: "browser-bridge-session-id",
            nextRoute: "/candidate/session/browser-bridge-session-id",
        });
        expect(response.status).toBe(201);
        expect(createSetupSession).not.toHaveBeenCalled();
    });

    it("rejects an identity-less setup transition when browser-bridge mode is not explicitly allowed", async () => {
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and label materials.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-14T20:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            allowBrowserBridgeWithoutIdentity: false,
            resolveCandidateSetupIdentity: vi.fn(async () => null),
        });

        await expect(response.json()).resolves.toEqual({
            error: "Candidate access could not be verified.",
        });
        expect(response.status).toBe(401);
    });

    it("fails closed when durable persistence is attempted but unavailable", async () => {
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-09T16:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: {
                resolveSetupPrepContext: vi.fn(async () => ({
                    status: "resolved" as const,
                    roleProfileId: "33333333-3333-4333-8333-333333333333",
                    resolution: "created" as const,
                })),
            },
            practiceSessionRepository: {
                createSetupSession: vi.fn(async () => null),
            },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
        });

        await expect(response.json()).resolves.toEqual({
            error: "This setup request could not be completed. Your setup is still available, so you can try again.",
            code: "SETUP_START_CLAIM_LOST",
            retryable: true,
        });
        expect(response.status).toBe(409);
    });

    it("preserves setup for retry when question wording fails before session creation", async () => {
        const createSetupSession = vi.fn();
        const resolveSetupPrepContext = vi.fn(async () => ({
            status: "resolved" as const,
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            resolution: "reused_empty" as const,
        }));

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and label materials.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-18T20:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                allowManualPrepContextCreation: true,
            })),
            prepContextResolver: { resolveSetupPrepContext },
            practiceSessionRepository: { createSetupSession },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
            questionWordingRuntime: createFaultInjectionCandidateQuestionWordingRuntime("provider_unavailable"),
        });

        await expect(response.json()).resolves.toEqual({
            error: "Practice questions could not be prepared. Your setup is still available, so you can try again.",
            code: "QUESTION_WORDING_PROVIDER_PROVIDER_UNAVAILABLE",
            retryable: true,
        });
        expect(response.status).toBe(503);
        expect(resolveSetupPrepContext).toHaveBeenCalledTimes(1);
        expect(createSetupSession).not.toHaveBeenCalled();
    });

    it("fails closed before session creation when no candidate-owned prep context resolves", async () => {
        const createSetupSession = vi.fn();
        const resolveSetupPrepContext = vi.fn(async () => null);

        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                headers: { "Idempotency-Key": setupStartIdempotencyKey },
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and label materials.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-14T20:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                roleProfileId: "unowned-role-profile",
                allowManualPrepContextCreation: false,
            })),
            prepContextResolver: {
                resolveSetupPrepContext,
            },
            practiceSessionRepository: {
                createSetupSession,
            },
            setupStartRequestRepository: createAcquiredSetupStartRequestRepository(),
        });

        await expect(response.json()).resolves.toEqual({
            error: "Candidate preparation context could not be resolved.",
        });
        expect(response.status).toBe(503);
        expect(resolveSetupPrepContext).toHaveBeenCalledWith(expect.objectContaining({
            requestedRoleProfileId: "unowned-role-profile",
            allowManualCreation: false,
        }));
        expect(createSetupSession).not.toHaveBeenCalled();
    });

    it("does not silently use browser-bridge state when durable identity lacks persistence dependencies", async () => {
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and label materials.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-14T20:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                allowBrowserBridgeFallback: false,
            })),
        });

        await expect(response.json()).resolves.toEqual({
            error: "Candidate practice session could not be saved.",
        });
        expect(response.status).toBe(503);
    });

    it("retains the explicit dev-only browser bridge when durable storage is absent", async () => {
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                body: JSON.stringify({
                    targetRole: "Material handler",
                    jobDescription: "Move and label materials.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-14T20:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                allowManualPrepContextCreation: true,
                allowBrowserBridgeFallback: true,
            })),
        });

        await expect(response.json()).resolves.toMatchObject({
            sessionId: "browser-bridge-session-id",
            nextRoute: "/candidate/session/browser-bridge-session-id",
        });
        expect(response.status).toBe(201);
    });

    it("reports identity lookup failures as setup-start infrastructure failures", async () => {
        const response = await handleCandidateSetupStartRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
                method: "POST",
                body: JSON.stringify({
                    targetRole: "Customer service representative",
                    jobDescription: "Help customers resolve service questions.",
                    interviewStage: "first_interview",
                    questionCount: 7,
                }),
            }),
            now: new Date("2026-07-09T16:00:00.000Z"),
            createSessionId: () => "browser-bridge-session-id",
            resolveCandidateSetupIdentity: async () => {
                throw new Error("relation candidate_launch_sessions does not exist");
            },
            practiceSessionRepository: {
                createSetupSession: vi.fn(),
            },
        });

        await expect(response.json()).resolves.toEqual({
            error: "Candidate setup could not be started.",
        });
        expect(response.status).toBe(503);
    });

    it("returns a bounded setup failure when the environment-selected wording profile is invalid", async () => {
        vi.stubEnv("CANDIDATE_QUESTION_WORDING_PROVIDER", "google_genai");
        vi.stubEnv("CANDIDATE_QUESTION_WORDING_PROFILE", "wrong-profile");
        vi.stubEnv("GEMINI_API_KEY", "server-only-test-key");

        const response = await POST(new Request("https://interviewcoach.talentarbor.com/candidate/setup/start", {
            method: "POST",
            body: JSON.stringify({
                targetRole: "Customer service representative",
                jobDescription: "Help customers resolve service questions.",
                interviewStage: "first_interview",
                questionCount: 7,
            }),
        }));

        await expect(response.json()).resolves.toEqual({
            error: "Practice questions could not be prepared. Your setup is still available, so you can try again.",
            code: "QUESTION_WORDING_PROVIDER_MISCONFIGURED",
            retryable: false,
        });
        expect(response.status).toBe(503);
    });
});
