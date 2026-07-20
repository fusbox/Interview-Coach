import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { normalizeCandidateRoleProfileId } from "@/features/candidate-dashboard-v2/candidate-dashboard-route";
import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";
import type {
    CandidateNextRoundBuilderMutation,
    CandidateNextRoundBuilderMutationResult,
} from "@/features/candidate-practice-v2/candidate-next-round-builder-service";
import {
    createCandidateNextRoundRuntime,
    resolveCandidateNextRoundProfileId,
} from "@/features/candidate-practice-v2/candidate-next-round-runtime";

type CandidateNextRoundDraftRouteDependencies = {
    resolveIdentity: () => Promise<{ candidateProfileId: string } | null>;
    loadBuilder: (input: {
        candidateProfileId: string;
        roleProfileId: string;
    }) => Promise<CandidateNextRoundBuilderModel | null>;
    mutateBuilder: (input: {
        candidateProfileId: string;
        roleProfileId: string;
        candidateNextRoundDraftId: string;
        expectedVersion: number;
        mutation: CandidateNextRoundBuilderMutation;
    }) => Promise<CandidateNextRoundBuilderMutationResult>;
};

export async function GET(request: Request) {
    return handleCandidateNextRoundDraftGetRequest({
        request,
        ...createDefaultDependencies(),
    });
}

export async function POST(request: Request) {
    return handleCandidateNextRoundDraftMutationRequest({
        request,
        ...createDefaultDependencies(),
    });
}

export async function handleCandidateNextRoundDraftGetRequest({
    request,
    resolveIdentity,
    loadBuilder,
}: {
    request: Request;
} & Pick<CandidateNextRoundDraftRouteDependencies, "resolveIdentity" | "loadBuilder">) {
    const roleProfileId = normalizeCandidateRoleProfileId(new URL(request.url).searchParams.get("prep"));
    if (!roleProfileId) {
        return jsonResponse({ error: "A valid prep context is required." }, 400);
    }

    const identity = await resolveIdentity();
    if (!identity) {
        return jsonResponse({ error: "Candidate identity could not be confirmed." }, 401);
    }

    try {
        const builder = await loadBuilder({
            candidateProfileId: identity.candidateProfileId,
            roleProfileId,
        });
        return builder
            ? jsonResponse({ builder }, 200)
            : jsonResponse({ error: "The next practice round is unavailable for this prep context." }, 404);
    } catch {
        return jsonResponse({ error: "The next practice round could not be loaded." }, 503);
    }
}

export async function handleCandidateNextRoundDraftMutationRequest({
    request,
    resolveIdentity,
    mutateBuilder,
}: {
    request: Request;
} & Pick<CandidateNextRoundDraftRouteDependencies, "resolveIdentity" | "mutateBuilder">) {
    const payload = parseMutationPayload(await readJson(request));
    if (!payload) {
        return jsonResponse({ error: "Invalid next-round change." }, 400);
    }

    const identity = await resolveIdentity();
    if (!identity) {
        return jsonResponse({ error: "Candidate identity could not be confirmed." }, 401);
    }

    try {
        const result = await mutateBuilder({
            candidateProfileId: identity.candidateProfileId,
            ...payload,
        });
        if (!result.builder && (result.outcome === "updated" || result.outcome === "unchanged")) {
            return jsonResponse({ error: "The change was saved, but the round could not be reloaded." }, 503);
        }

        return jsonResponse(result, mutationStatus(result.outcome));
    } catch {
        return jsonResponse({ error: "The next practice round could not be updated." }, 503);
    }
}

function parseMutationPayload(value: unknown): {
    roleProfileId: string;
    candidateNextRoundDraftId: string;
    expectedVersion: number;
    mutation: CandidateNextRoundBuilderMutation;
} | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const payload = value as Record<string, unknown>;
    const roleProfileId = normalizeCandidateRoleProfileId(readString(payload.roleProfileId));
    const candidateNextRoundDraftId = readStableId(payload.candidateNextRoundDraftId);
    const expectedVersion = readPositiveInteger(payload.expectedVersion);
    const mutation = parseMutation(payload.mutation);
    return roleProfileId && candidateNextRoundDraftId && expectedVersion && mutation
        ? { roleProfileId, candidateNextRoundDraftId, expectedVersion, mutation }
        : null;
}

function parseMutation(value: unknown): CandidateNextRoundBuilderMutation | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const mutation = value as Record<string, unknown>;
    if (mutation.kind === "clear") {
        return { kind: "clear" };
    }
    if (mutation.kind === "add") {
        const sourceCandidatePracticeSessionId = readStableId(mutation.sourceCandidatePracticeSessionId);
        const sourceQuestionKey = readStableId(mutation.sourceQuestionKey);
        return sourceCandidatePracticeSessionId && sourceQuestionKey
            ? { kind: "add", sourceCandidatePracticeSessionId, sourceQuestionKey }
            : null;
    }
    if (mutation.kind === "remove") {
        const candidateNextRoundDraftItemId = readStableId(mutation.candidateNextRoundDraftItemId);
        return candidateNextRoundDraftItemId ? { kind: "remove", candidateNextRoundDraftItemId } : null;
    }
    if (mutation.kind === "reorder" && Array.isArray(mutation.orderedItemIds)) {
        const orderedItemIds = mutation.orderedItemIds.map(readStableId);
        return orderedItemIds.length > 0 && orderedItemIds.every(Boolean)
            ? { kind: "reorder", orderedItemIds: orderedItemIds as string[] }
            : null;
    }
    return null;
}

function mutationStatus(outcome: CandidateNextRoundBuilderMutationResult["outcome"]) {
    if (outcome === "updated" || outcome === "unchanged") return 200;
    if (outcome === "version_conflict" || outcome === "capacity_exceeded") return 409;
    if (outcome === "not_found") return 404;
    return 422;
}

function createDefaultDependencies(): CandidateNextRoundDraftRouteDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return unavailableDependencies();
    }

    const runtime = createCandidateNextRoundRuntime(databaseUrl);
    return {
        async resolveIdentity() {
            const { headers } = await import("next/headers");
            const requestHeaders = await headers();
            const candidateProfileId = await resolveCandidateNextRoundProfileId(
                requestHeaders.get("cookie"),
                runtime.queryClient,
            );
            return candidateProfileId ? { candidateProfileId } : null;
        },
        loadBuilder: runtime.loadBuilder,
        mutateBuilder: runtime.mutateBuilder,
    };
}

function unavailableDependencies(): CandidateNextRoundDraftRouteDependencies {
    return {
        resolveIdentity: async () => null,
        loadBuilder: async () => null,
        mutateBuilder: async () => ({
            status: "candidate_next_round_builder_mutation",
            outcome: "not_found",
            builder: null,
        }),
    };
}

async function readJson(request: Request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

function readString(value: unknown) {
    return typeof value === "string" ? value : null;
}

function readStableId(value: unknown) {
    const normalized = readString(value)?.trim();
    return normalized && normalized.length <= 160 && /^[A-Za-z0-9._:-]+$/.test(normalized)
        ? normalized
        : null;
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
