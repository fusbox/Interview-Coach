import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { normalizeCandidateRoleProfileId } from "@/features/candidate-dashboard-v2/candidate-dashboard-route";
import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";
import type { CandidateNextRoundDraftLaunchResult } from "@/features/candidate-practice-v2/candidate-next-round-draft-launch";
import {
    createCandidateNextRoundRuntime,
    resolveCandidateNextRoundProfileId,
} from "@/features/candidate-practice-v2/candidate-next-round-runtime";

type CandidateNextRoundLaunchDependencies = {
    resolveIdentity: () => Promise<{ candidateProfileId: string } | null>;
    launchBuilder: (input: {
        candidateProfileId: string;
        roleProfileId: string;
        candidateNextRoundDraftId: string;
        expectedVersion: number;
    }) => Promise<CandidateNextRoundDraftLaunchResult>;
    loadBuilder: (input: {
        candidateProfileId: string;
        roleProfileId: string;
    }) => Promise<CandidateNextRoundBuilderModel | null>;
};

export async function POST(request: Request) {
    return handleCandidateNextRoundDraftLaunchRequest({
        request,
        ...createDefaultDependencies(),
    });
}

export async function handleCandidateNextRoundDraftLaunchRequest({
    request,
    resolveIdentity,
    launchBuilder,
    loadBuilder,
}: {
    request: Request;
} & CandidateNextRoundLaunchDependencies) {
    const payload = parseLaunchPayload(await readJson(request));
    if (!payload) {
        return jsonResponse({ error: "Invalid next-round launch." }, 400);
    }

    const identity = await resolveIdentity();
    if (!identity) {
        return jsonResponse({ error: "Candidate identity could not be confirmed." }, 401);
    }

    try {
        const result = await launchBuilder({
            candidateProfileId: identity.candidateProfileId,
            ...payload,
        });
        if (result.status === "candidate_next_round_draft_launched") {
            return jsonResponse(result, result.outcome === "created" ? 201 : 200);
        }

        const builder = result.reason === "version_conflict" || result.reason === "invalid_items"
            ? await loadBuilder({
                candidateProfileId: identity.candidateProfileId,
                roleProfileId: payload.roleProfileId,
            })
            : null;
        return jsonResponse({ ...result, builder }, launchFailureStatus(result.reason));
    } catch {
        return jsonResponse({ error: "The next practice round could not be started." }, 503);
    }
}

function parseLaunchPayload(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const payload = value as Record<string, unknown>;
    const roleProfileId = normalizeCandidateRoleProfileId(
        typeof payload.roleProfileId === "string" ? payload.roleProfileId : null,
    );
    const candidateNextRoundDraftId = readStableId(payload.candidateNextRoundDraftId);
    const expectedVersion = readPositiveInteger(payload.expectedVersion);
    return roleProfileId && candidateNextRoundDraftId && expectedVersion
        ? { roleProfileId, candidateNextRoundDraftId, expectedVersion }
        : null;
}

function launchFailureStatus(reason: Extract<
    CandidateNextRoundDraftLaunchResult,
    { status: "candidate_next_round_draft_not_launched" }
>["reason"]) {
    if (reason === "not_found") return 404;
    if (reason === "version_conflict" || reason === "launched_intent_unavailable") return 409;
    return 422;
}

function createDefaultDependencies(): CandidateNextRoundLaunchDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {
            resolveIdentity: async () => null,
            launchBuilder: async () => ({
                status: "candidate_next_round_draft_not_launched",
                reason: "not_found",
            }),
            loadBuilder: async () => null,
        };
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
        launchBuilder: runtime.launchBuilder,
        loadBuilder: runtime.loadBuilder,
    };
}

async function readJson(request: Request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

function readStableId(value: unknown) {
    const normalized = typeof value === "string" ? value.trim() : "";
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
