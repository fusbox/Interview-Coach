import { randomUUID } from "crypto";

import { createCandidateSetupSessionTransition } from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import { safeParseCandidateSetupInput } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { CandidateProvisionalSessionProgress } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import {
    createCandidatePracticeSessionRepository,
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
    createCandidateSetupEntryRepository,
    type CandidateTrustedSetupContext,
} from "@/features/candidate-setup-v2/candidate-setup-entry-context";

export async function POST(request: Request) {
    return handleCandidateSetupStartRequest({
        request,
        now: new Date(),
        createSessionId: () => randomUUID(),
        ...createDefaultCandidateSetupStartDependencies(),
    });
}

type CandidateSetupIdentity = {
    candidateProfileId: string;
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
};

type CandidateSetupEntryRepository = Pick<
    ReturnType<typeof createCandidateSetupEntryRepository>,
    "consumeWithExistingPrepContext"
>;

export type CandidateSetupStartDependencies = {
    now: Date;
    createSessionId: () => string;
    allowBrowserBridgeWithoutIdentity?: boolean;
    resolveCandidateSetupIdentity?: (request: Request) => Promise<CandidateSetupIdentity | null>;
    prepContextResolver?: CandidateSetupPrepContextResolver;
    setupEntryRepository?: CandidateSetupEntryRepository;
    practiceSessionRepository?: CandidateSetupStartPracticeSessionRepository;
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
            parsedSetup.data,
            identity?.trustedSetupContext ?? null,
        );
        if (!canonicalSetup) {
            return Response.json({
                error: "Trusted job context changed before setup was submitted.",
            }, { status: 409 });
        }
        const result = createCandidateSetupSessionTransition({
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
            if (!prepContextResolver) {
                return Response.json({
                    error: "Candidate preparation context could not be resolved.",
                }, { status: 503 });
            }

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
                setupSnapshot: result.setupSnapshot,
            });
            if (!prepContext) {
                return Response.json({
                    error: "Candidate preparation context could not be resolved.",
                }, { status: 503 });
            }

            if (prepContext.status === "existing_paths") {
                return Response.json({
                    status: "existing_prep_context_found",
                    existingPrepContexts: prepContext.existingPrepContexts,
                }, { status: 409 });
            }

            if (prepContext.status === "decision_invalid") {
                return Response.json({
                    error: "That existing practice path is no longer available. Review the current choices and try again.",
                }, { status: 409 });
            }

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
                questionPlanSnapshot: result.questionPlanSnapshot,
                questionWordingSnapshot: result.questionWordingSnapshot,
                progress,
            });

            if (durableSession) {
                return Response.json({
                    ...result,
                    sessionId: durableSession.candidatePracticeSessionId,
                    nextRoute: `/candidate/session/${encodeURIComponent(durableSession.candidatePracticeSessionId)}`,
                }, { status: 201 });
            }

            return Response.json({
                error: "Candidate practice session could not be saved.",
            }, { status: 503 });
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

        return Response.json(result, { status: 201 });
    } catch {
        return Response.json({ error: "Candidate setup could not be started." }, { status: 503 });
    }
}

function createDefaultCandidateSetupStartDependencies(): Pick<
    CandidateSetupStartDependencies,
    "allowBrowserBridgeWithoutIdentity" | "resolveCandidateSetupIdentity" | "prepContextResolver" | "setupEntryRepository" | "practiceSessionRepository"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    const allowBrowserBridgeWithoutIdentity = process.env.NODE_ENV !== "production";
    if (!databaseUrl) {
        return isCandidateDevHostLaunchEnabled()
            ? {
                allowBrowserBridgeWithoutIdentity,
                resolveCandidateSetupIdentity: resolveCandidateSetupIdentityFromDevLaunchCookie,
            }
            : { allowBrowserBridgeWithoutIdentity };
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
    };
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
            candidateLaunchSessionId: null,
            trustedSetupContext: null,
            allowManualPrepContextCreation: true,
            allowBrowserBridgeFallback: true,
        }
        : null;
}
