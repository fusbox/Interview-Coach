import { randomUUID } from "crypto";

import {
    completeCandidateSetupSessionTransition,
    createCandidateSetupSessionPlan,
    type CandidateSetupSessionPlanResult,
} from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import {
    safeParseCandidateSetupInput,
    type CandidateSetupPayload,
} from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { CandidateProvisionalSessionProgress } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import {
    createCandidatePracticeSessionRepository,
    type CandidatePracticeSessionRecord,
    type CreateCandidatePracticeSessionInput,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidatePostgresQueryClient } from "@/features/candidate-auth-v2/candidate-postgres-runtime";
import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { isCandidateDevHostLaunchEnabled } from "@/features/candidate-auth-v2/dev-host-launch";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import {
    createCandidateSetupPrepContextRepository,
    type CandidateSetupPrepContextResolver,
} from "@/features/candidate-setup-v2/candidate-setup-prep-context-repository";
import {
    applyCandidateTrustedSetupContext,
    createCandidateSetupDraftOwnerKey,
    createCandidateSetupEntryRepository,
    type CandidateTrustedSetupContext,
} from "@/features/candidate-setup-v2/candidate-setup-entry-context";
import {
    createCandidateQuestionWordingRequest,
} from "@/features/candidate-session-v2/candidate-question-wording";
import {
    CandidateQuestionWordingRuntimeError,
    createFixtureCandidateQuestionWordingRuntime,
    type CandidateQuestionWordingRuntime,
    type CandidateQuestionWordingRuntimeTelemetry,
} from "@/features/candidate-session-v2/candidate-question-wording-runtime";
import { createCandidateQuestionWordingRuntimeFromEnvironment } from "@/features/candidate-session-v2/candidate-question-wording-runtime-selection";
import {
    CANDIDATE_SETUP_START_IDEMPOTENCY_HEADER,
    createCandidateSetupStartClaimTimes,
    createCandidateSetupStartRequestFingerprint,
    hashCandidateSetupStartIdempotencyKey,
    normalizeCandidateSetupStartIdempotencyKey,
    type CandidateSetupStartClaim,
} from "@/features/candidate-setup-v2/candidate-setup-start-request";
import {
    createCandidateSetupStartRequestRepository,
} from "@/features/candidate-setup-v2/candidate-setup-start-request-repository";
import type { CandidateResumeTextArtifact } from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
import { createCandidateSetupResumeSelectionRepository } from "@/features/candidate-setup-v2/candidate-setup-resume-selection-repository";

export async function POST(request: Request) {
    try {
        return await handleCandidateSetupStartRequest({
            request,
            now: new Date(),
            createSessionId: () => randomUUID(),
            ...createDefaultCandidateSetupStartDependencies(),
        });
    } catch (error) {
        return createCandidateSetupStartFailureResponse(error);
    }
}

type CandidateSetupIdentity = {
    candidateProfileId: string;
    setupOwnerKey?: string | null;
    roleProfileId?: string | null;
    candidateLaunchSessionId?: string | null;
    trustedSetupContext?: CandidateTrustedSetupContext | null;
    allowManualPrepContextCreation?: boolean;
    allowBrowserBridgeFallback?: boolean;
};

type CandidateSetupStartPracticeSessionRepository = {
    createSetupSession: (input: CreateCandidatePracticeSessionInput) => Promise<{
        candidatePracticeSessionId: string;
    } | null>;
    findSetupSession?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
    }) => Promise<CandidatePracticeSessionRecord | null>;
};

type CandidateSetupStartRequestRepository = Pick<
    ReturnType<typeof createCandidateSetupStartRequestRepository>,
    "claimSetupStart" | "failSetupStart"
>;

type CandidateSetupEntryRepository = Pick<
    ReturnType<typeof createCandidateSetupEntryRepository>,
    "consumeWithExistingPrepContext"
>;

type CandidateSetupResumeSelectionRepository = Pick<
    ReturnType<typeof createCandidateSetupResumeSelectionRepository>,
    "resolveAcceptedSelection" | "clearSelection"
>;

export type CandidateSetupStartDependencies = {
    now: Date;
    createSessionId: () => string;
    allowBrowserBridgeWithoutIdentity?: boolean;
    resolveCandidateSetupIdentity?: (request: Request) => Promise<CandidateSetupIdentity | null>;
    prepContextResolver?: CandidateSetupPrepContextResolver;
    setupEntryRepository?: CandidateSetupEntryRepository;
    practiceSessionRepository?: CandidateSetupStartPracticeSessionRepository;
    setupStartRequestRepository?: CandidateSetupStartRequestRepository;
    resumeSelectionRepository?: CandidateSetupResumeSelectionRepository;
    questionWordingRuntime?: CandidateQuestionWordingRuntime | null;
};

export async function handleCandidateSetupStartRequest({
    request,
    now,
    createSessionId,
    allowBrowserBridgeWithoutIdentity = false,
    resolveCandidateSetupIdentity,
    prepContextResolver,
    setupEntryRepository,
    practiceSessionRepository,
    setupStartRequestRepository,
    resumeSelectionRepository,
    questionWordingRuntime = createFixtureCandidateQuestionWordingRuntime(),
}: CandidateSetupStartDependencies & {
    request: Request;
}) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid setup request." }, { status: 400 });
    }

    const parsedSetup = safeParseCandidateSetupInput(body);
    if (!parsedSetup.success) {
        return Response.json({
            error: "Invalid setup request.",
            fieldErrors: parsedSetup.error.flatten().fieldErrors,
        }, { status: 400 });
    }

    const prepContextDecision = readPrepContextDecision(body);
    if (prepContextDecision === "invalid") {
        return Response.json({ error: "Invalid preparation-context choice." }, { status: 400 });
    }
    const setupEntryMode = readSetupEntryMode(body);
    if (setupEntryMode === "invalid") {
        return Response.json({ error: "Invalid setup entry mode." }, { status: 400 });
    }

    try {
        const identity = resolveCandidateSetupIdentity
            ? await resolveCandidateSetupIdentity(request)
            : null;
        const resumeResolution = await resolveCandidateSetupAcceptedResume({
            setup: parsedSetup.data,
            identity,
            repository: resumeSelectionRepository,
        });
        if (resumeResolution instanceof Response) {
            return resumeResolution;
        }
        const hasTrustedSetupContext = Boolean(identity?.trustedSetupContext);
        if (
            (setupEntryMode === "trusted_host_job" && !hasTrustedSetupContext)
            || (setupEntryMode === null && hasTrustedSetupContext)
        ) {
            return Response.json({
                error: "Trusted job context is no longer available. Reload setup and try again.",
            }, { status: 409 });
        }
        const canonicalSetup = applyCandidateTrustedSetupContext(
            resumeResolution,
            identity?.trustedSetupContext ?? null,
        );
        if (!canonicalSetup) {
            return Response.json({
                error: "Trusted job context changed before setup was submitted.",
            }, { status: 409 });
        }
        const plan = createCandidateSetupSessionPlan({
            payload: canonicalSetup,
            now,
            createSessionId,
        });

        if (prepContextDecision?.action === "use_existing_path") {
            if (
                !identity?.trustedSetupContext
                || !identity.candidateLaunchSessionId
                || !setupEntryRepository
            ) {
                return Response.json({
                    error: "That existing practice path is no longer available. Reload setup and try again.",
                }, { status: 409 });
            }

            if (identity.setupOwnerKey && resumeSelectionRepository) {
                await resumeSelectionRepository.clearSelection({
                    candidateProfileId: identity.candidateProfileId,
                    setupOwnerKey: identity.setupOwnerKey,
                    now,
                });
            }

            const consumed = await setupEntryRepository.consumeWithExistingPrepContext({
                candidateProfileId: identity.candidateProfileId,
                candidateLaunchSessionId: identity.candidateLaunchSessionId,
                roleProfileId: prepContextDecision.matchingRoleProfileId,
            });
            if (!consumed) {
                return Response.json({
                    error: "That existing practice path is no longer available. Reload setup and try again.",
                }, { status: 409 });
            }

            return Response.json({
                status: "existing_prep_context_selected",
                nextRoute: `/candidate/dashboard?prep=${encodeURIComponent(prepContextDecision.matchingRoleProfileId)}`,
            });
        }

        if (identity && practiceSessionRepository) {
            if (!prepContextResolver || !setupStartRequestRepository) {
                return Response.json({
                    error: "Candidate setup is temporarily unavailable.",
                }, { status: 503 });
            }

            const idempotencyKey = normalizeCandidateSetupStartIdempotencyKey(
                request.headers.get(CANDIDATE_SETUP_START_IDEMPOTENCY_HEADER),
            );
            if (!idempotencyKey) {
                return Response.json({
                    error: "This setup request needs a fresh request key. Reload setup and try again.",
                    code: "SETUP_START_IDEMPOTENCY_KEY_REQUIRED",
                    retryable: true,
                }, { status: 400 });
            }

            const idempotencyKeyHash = hashCandidateSetupStartIdempotencyKey(idempotencyKey);
            const requestFingerprint = createCandidateSetupStartRequestFingerprint({
                setup: canonicalSetup,
                setupEntryMode,
                prepContextAnchor: {
                    requestedRoleProfileId: identity.roleProfileId ?? null,
                    candidateLaunchSessionId: identity.candidateLaunchSessionId ?? null,
                    sourcePlatform: identity.trustedSetupContext?.sourcePlatform ?? null,
                    jobCollectionId: identity.trustedSetupContext?.jobCollectionId ?? null,
                    requirementId: identity.trustedSetupContext?.requirementId ?? null,
                },
                prepContextDecision: prepContextDecision?.action === "create_separate_path"
                    ? {
                        action: "create_separate_path",
                        matchingRoleProfileId: prepContextDecision.matchingRoleProfileId,
                    }
                    : null,
            });
            const claimTimes = createCandidateSetupStartClaimTimes(now);
            const claimResult = await setupStartRequestRepository.claimSetupStart({
                candidateProfileId: identity.candidateProfileId,
                idempotencyKeyHash,
                requestFingerprint,
                ...claimTimes,
            });
            if (!claimResult) {
                return Response.json({
                    error: "Candidate setup could not be reserved.",
                }, { status: 503 });
            }

            if (claimResult.outcome === "conflict") {
                return Response.json({
                    error: "This setup changed after the request began. Review it and try again.",
                    code: "SETUP_START_IDEMPOTENCY_CONFLICT",
                    retryable: true,
                }, { status: 409 });
            }

            if (claimResult.outcome === "in_progress") {
                return Response.json({
                    error: "I am still preparing this practice round. Try again in a moment.",
                    code: "SETUP_START_IN_PROGRESS",
                    retryable: true,
                }, {
                    status: 409,
                    headers: { "Retry-After": "2" },
                });
            }

            if (claimResult.outcome === "replayed") {
                const replayedSession = practiceSessionRepository.findSetupSession
                    ? await practiceSessionRepository.findSetupSession({
                        candidatePracticeSessionId: claimResult.candidatePracticeSessionId,
                        candidateProfileId: identity.candidateProfileId,
                    })
                    : null;
                const replayedResult = replayedSession
                    ? toCandidateSetupSessionResult(replayedSession)
                    : null;
                if (!replayedResult) {
                    return Response.json({
                        error: "The saved practice round could not be recovered.",
                    }, { status: 503 });
                }
                return Response.json(replayedResult, { status: 200 });
            }

            const activeClaim: CandidateSetupStartClaim = claimResult;
            try {
                const prepContext = await prepContextResolver.resolveSetupPrepContext({
                    candidateProfileId: identity.candidateProfileId,
                    requestedRoleProfileId: identity.roleProfileId ?? null,
                    createSeparateFromRoleProfileId: prepContextDecision?.action === "create_separate_path"
                        ? prepContextDecision.matchingRoleProfileId
                        : null,
                    allowManualCreation: identity.allowManualPrepContextCreation === true,
                    trustedLaunchContext: identity.trustedSetupContext ?? null,
                    trustedLaunchSessionId: identity.trustedSetupContext
                        ? identity.candidateLaunchSessionId ?? null
                        : null,
                    setupSnapshot: plan.setupSnapshot,
                });
                if (!prepContext) {
                    await failSetupStartClaimSafely(setupStartRequestRepository, identity.candidateProfileId, activeClaim, now, "PREP_CONTEXT_UNAVAILABLE");
                    return Response.json({
                        error: "Candidate preparation context could not be resolved.",
                    }, { status: 503 });
                }

                if (prepContext.status === "existing_paths") {
                    await failSetupStartClaimSafely(setupStartRequestRepository, identity.candidateProfileId, activeClaim, now, "PREP_CONTEXT_DECISION_REQUIRED");
                    return Response.json({
                        status: "existing_prep_context_found",
                        existingPrepContexts: prepContext.existingPrepContexts,
                    }, { status: 409 });
                }

                if (prepContext.status === "decision_invalid") {
                    await failSetupStartClaimSafely(setupStartRequestRepository, identity.candidateProfileId, activeClaim, now, "PREP_CONTEXT_DECISION_INVALID");
                    return Response.json({
                        error: "That existing practice path is no longer available. Review the current choices and try again.",
                    }, { status: 409 });
                }

                const result = await createWordedSetupTransition({
                    plan,
                    runtime: questionWordingRuntime,
                    now,
                });

                const progress: CandidateProvisionalSessionProgress = {
                    status: "planned",
                    currentQuestionIndex: 0,
                };
                const durableSession = await practiceSessionRepository.createSetupSession({
                    candidateProfileId: identity.candidateProfileId,
                    roleProfileId: prepContext.roleProfileId,
                    candidateLaunchSessionId: identity.candidateLaunchSessionId ?? null,
                    consumeTrustedLaunchSetupContext: Boolean(identity.trustedSetupContext),
                    setupSnapshot: result.setupSnapshot,
                    rigorBaselineSnapshot: result.rigorBaselineSnapshot,
                    rigorBaselineQuestionWordingSnapshot: result.rigorBaselineQuestionWordingSnapshot,
                    questionPlanSnapshot: result.questionPlanSnapshot,
                    questionWordingSnapshot: result.questionWordingSnapshot,
                    progress,
                    setupStartClaim: activeClaim,
                    resumeSelectionOwnerKey: identity.setupOwnerKey ?? null,
                });

                if (durableSession) {
                    return Response.json({
                        ...result,
                        sessionId: durableSession.candidatePracticeSessionId,
                        nextRoute: `/candidate/session/${encodeURIComponent(durableSession.candidatePracticeSessionId)}`,
                    }, { status: 201 });
                }

                await failSetupStartClaimSafely(setupStartRequestRepository, identity.candidateProfileId, activeClaim, now, "SETUP_START_CLAIM_LOST");
                return Response.json({
                    error: "This setup request could not be completed. Your setup is still available, so you can try again.",
                    code: "SETUP_START_CLAIM_LOST",
                    retryable: true,
                }, { status: 409 });
            } catch (error) {
                await failSetupStartClaimSafely(
                    setupStartRequestRepository,
                    identity.candidateProfileId,
                    activeClaim,
                    now,
                    error instanceof CandidateQuestionWordingRuntimeError
                        ? error.errorCode
                        : "SETUP_START_FAILED",
                );
                throw error;
            }
        }

        if (identity && !identity.allowBrowserBridgeFallback) {
            return Response.json({
                error: "Candidate practice session could not be saved.",
            }, { status: 503 });
        }

        if (!identity && !allowBrowserBridgeWithoutIdentity) {
            return Response.json({
                error: "Candidate access could not be verified.",
            }, { status: 401 });
        }


        const result = await createWordedSetupTransition({
            plan,
            runtime: questionWordingRuntime,
            now,
        });

        return Response.json(result, { status: 201 });
    } catch (error) {
        return createCandidateSetupStartFailureResponse(error);
    }
}

function createDefaultCandidateSetupStartDependencies(): Pick<
    CandidateSetupStartDependencies,
    "allowBrowserBridgeWithoutIdentity" | "resolveCandidateSetupIdentity" | "prepContextResolver" | "setupEntryRepository" | "practiceSessionRepository" | "setupStartRequestRepository" | "resumeSelectionRepository" | "questionWordingRuntime"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    const allowBrowserBridgeWithoutIdentity = process.env.NODE_ENV !== "production";
    if (!databaseUrl) {
        return isCandidateDevHostLaunchEnabled()
            ? {
                allowBrowserBridgeWithoutIdentity,
                resolveCandidateSetupIdentity: resolveCandidateSetupIdentityFromDevLaunchCookie,
                questionWordingRuntime: createDefaultQuestionWordingRuntime(),
            }
            : {
                allowBrowserBridgeWithoutIdentity,
                questionWordingRuntime: createDefaultQuestionWordingRuntime(),
            };
    }

    const queryClient = createCandidatePostgresQueryClient(databaseUrl);

    const setupEntryRepository = createCandidateSetupEntryRepository(queryClient);
    return {
        allowBrowserBridgeWithoutIdentity,
        resolveCandidateSetupIdentity: async (request) => {
            const devIdentity = await resolveCandidateSetupIdentityFromDevLaunchCookie(request);
            return devIdentity ?? resolveCandidateSetupIdentityFromLaunchCookie(request, queryClient);
        },
        prepContextResolver: createCandidateSetupPrepContextRepository(queryClient),
        setupEntryRepository,
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
        setupStartRequestRepository: createCandidateSetupStartRequestRepository(queryClient),
        resumeSelectionRepository: createCandidateSetupResumeSelectionRepository(queryClient),
        questionWordingRuntime: createDefaultQuestionWordingRuntime(),
    };
}

async function resolveCandidateSetupAcceptedResume({
    setup,
    identity,
    repository,
}: {
    setup: CandidateSetupPayload;
    identity: CandidateSetupIdentity | null;
    repository?: CandidateSetupResumeSelectionRepository;
}): Promise<CandidateSetupPayload | Response> {
    if (!identity) {
        return setup;
    }
    if (!setup.resumeArtifact) {
        return setup.resumeText
            ? Response.json({
                error: "Review and accept the processed resume text before starting practice.",
                code: "RESUME_REVIEW_REQUIRED",
            }, { status: 409 })
            : setup;
    }
    if (setup.resumeArtifact.reviewState !== "accepted") {
        return Response.json({
            error: "Review and accept the processed resume text before starting practice.",
            code: "RESUME_REVIEW_REQUIRED",
        }, { status: 409 });
    }
    if (!repository) {
        return Response.json({
            error: "Accepted resume text could not be verified.",
            code: "RESUME_REVIEW_UNAVAILABLE",
        }, { status: 503 });
    }

    if (!identity.setupOwnerKey) {
        return Response.json({
            error: "Accepted resume text could not be verified.",
            code: "RESUME_REVIEW_UNAVAILABLE",
        }, { status: 503 });
    }

    const artifact = await repository.resolveAcceptedSelection({
        candidateProfileId: identity.candidateProfileId,
        setupOwnerKey: identity.setupOwnerKey,
        artifactId: setup.resumeArtifact.artifactId,
        version: setup.resumeArtifact.version,
        revision: setup.resumeArtifact.revision,
    });
    if (!artifact) {
        return Response.json({
            error: "That resume review is no longer current. Review the resume again before starting practice.",
            code: "RESUME_REVIEW_STALE",
        }, { status: 409 });
    }

    return {
        ...setup,
        resumeText: artifact.normalizedText,
        resumeCaptureMode: artifact.source,
        resumeArtifact: toAcceptedResumeReference(artifact),
    };
}

function toAcceptedResumeReference(artifact: CandidateResumeTextArtifact) {
    return {
        artifactId: artifact.artifactId,
        version: artifact.version,
        revision: artifact.revision,
        source: artifact.source,
        candidateLabel: artifact.candidateLabel,
        reviewState: "accepted" as const,
    };
}

async function createWordedSetupTransition({
    plan,
    runtime,
    now,
}: {
    plan: CandidateSetupSessionPlanResult;
    runtime: CandidateQuestionWordingRuntime | null;
    now: Date;
}) {
    if (!runtime) {
        throw new CandidateQuestionWordingRuntimeError("misconfigured");
    }
    const request = createCandidateQuestionWordingRequest({
        setupSnapshot: {
            ...plan.setupSnapshot,
            questionCount: plan.questionGenerationPlanSnapshot.questionCount,
        },
        questionPlanSnapshot: plan.questionGenerationPlanSnapshot,
        now,
    });
    const questionGenerationWordingSnapshot = await runtime.wordQuestions(request);
    return completeCandidateSetupSessionTransition({ plan, questionGenerationWordingSnapshot });
}

function toCandidateSetupSessionResult(session: CandidatePracticeSessionRecord) {
    if (!session.questionWordingSnapshot) {
        return null;
    }
    return {
        status: "session_created" as const,
        sessionId: session.candidatePracticeSessionId,
        nextRoute: `/candidate/session/${encodeURIComponent(session.candidatePracticeSessionId)}` as const,
        setupSnapshot: session.setupSnapshot,
        questionPlanSnapshot: session.questionPlanSnapshot,
        questionWordingSnapshot: session.questionWordingSnapshot,
    };
}

async function failSetupStartClaimSafely(
    repository: CandidateSetupStartRequestRepository,
    candidateProfileId: string,
    claim: CandidateSetupStartClaim,
    now: Date,
    errorCode: string,
) {
    try {
        await repository.failSetupStart({
            candidateProfileId,
            ...claim,
            failedAt: now.toISOString(),
            errorCode,
        });
    } catch (error) {
        console.warn("candidate_setup_start_claim_release_failed", {
            errorCode,
            errorName: error instanceof Error ? error.name : "unknown",
        });
    }
}

function createDefaultQuestionWordingRuntime() {
    return createCandidateQuestionWordingRuntimeFromEnvironment({
        env: { ...process.env },
        recordTelemetry: recordCandidateQuestionWordingTelemetry,
    });
}

function recordCandidateQuestionWordingTelemetry(event: CandidateQuestionWordingRuntimeTelemetry) {
    console.info("candidate_question_wording_runtime", event);
}

function createCandidateSetupStartFailureResponse(error: unknown) {
    if (error instanceof CandidateQuestionWordingRuntimeError) {
        return Response.json({
            error: "Practice questions could not be prepared. Your setup is still available, so you can try again.",
            code: error.errorCode,
            retryable: error.retryable,
        }, { status: 503 });
    }
    return Response.json({ error: "Candidate setup could not be started." }, { status: 503 });
}

async function resolveCandidateSetupIdentityFromLaunchCookie(
    request: Request,
    client: ReturnType<typeof createCandidatePostgresQueryClient>,
): Promise<CandidateSetupIdentity | null> {
    const candidateLaunchSessionId = readCookieValue(request.headers.get("Cookie"), CANDIDATE_HOST_LAUNCH_SESSION_COOKIE);
    if (!candidateLaunchSessionId) {
        return null;
    }

    const entry = await createCandidateSetupEntryRepository(client)
        .resolveLaunchEntry(candidateLaunchSessionId);

    return entry
        ? {
            candidateProfileId: entry.candidateProfileId,
            setupOwnerKey: createCandidateSetupDraftOwnerKey(
                entry.candidateProfileId,
                entry.trustedSetupContext,
            ),
            candidateLaunchSessionId: entry.candidateLaunchSessionId,
            trustedSetupContext: entry.trustedSetupContext,
            allowManualPrepContextCreation: true,
            allowBrowserBridgeFallback: false,
        }
        : null;
}

function readCookieValue(cookieHeader: string | null, name: string) {
    if (!cookieHeader) {
        return null;
    }

    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    if (!cookie) {
        return null;
    }

    return decodeURIComponent(cookie.slice(name.length + 1));
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function readPrepContextDecision(body: unknown): {
    action: "create_separate_path" | "use_existing_path";
    matchingRoleProfileId: string;
} | null | "invalid" {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return null;
    }

    const rawDecision = (body as Record<string, unknown>).prepContextDecision;
    if (rawDecision == null) {
        return null;
    }
    if (!rawDecision || typeof rawDecision !== "object" || Array.isArray(rawDecision)) {
        return "invalid";
    }

    const decision = rawDecision as Record<string, unknown>;
    const matchingRoleProfileId = readString(decision.matchingRoleProfileId);
    if (
        (decision.action !== "create_separate_path" && decision.action !== "use_existing_path")
        || !matchingRoleProfileId
    ) {
        return "invalid";
    }

    return {
        action: decision.action,
        matchingRoleProfileId,
    };
}

function readSetupEntryMode(body: unknown): "trusted_host_job" | null | "invalid" {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return null;
    }

    const value = (body as Record<string, unknown>).setupEntryMode;
    if (value == null) {
        return null;
    }
    return value === "trusted_host_job" ? value : "invalid";
}

export async function resolveCandidateSetupIdentityFromDevLaunchCookie(request: Request): Promise<CandidateSetupIdentity | null> {
    const identity = resolveCandidateDevHostLaunchCookieIdentity(request.headers.get("Cookie"));

    return identity
        ? {
            candidateProfileId: identity.candidateProfileId,
            setupOwnerKey: createCandidateSetupDraftOwnerKey(identity.candidateProfileId, null),
            candidateLaunchSessionId: null,
            trustedSetupContext: null,
            allowManualPrepContextCreation: true,
            allowBrowserBridgeFallback: true,
        }
        : null;
}
