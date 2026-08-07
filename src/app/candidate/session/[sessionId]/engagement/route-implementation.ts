import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    isCandidateEngagementActivityReason,
    isCandidateEngagementFlushReason,
    isCandidateEngagementOpenReason,
    type CandidateEngagementSlice,
} from "@/features/candidate-engagement-v2/candidate-engagement-contract";
import { isCandidateEngagementReportingEnabled } from "@/features/candidate-engagement-v2/candidate-engagement-config";
import {
    createCandidateEngagementRepository,
    type AppendCandidateEngagementSlicesResult,
} from "@/features/candidate-engagement-v2/candidate-engagement-repository";

const MAX_BATCH_SIZE = 20;
const MAX_INTERVAL_MS = 10 * 60 * 1000;
const MAX_PAST_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

type CandidateSessionIdentity = { candidateProfileId: string };

type CandidateEngagementRepository = {
    appendSlices(input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        slices: CandidateEngagementSlice[];
    }): Promise<AppendCandidateEngagementSlicesResult>;
};

export type CandidateEngagementRouteDependencies = {
    reportingEnabled?: boolean;
    now?: () => Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    engagementRepository?: CandidateEngagementRepository;
};

export async function POST(
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;
    return handleCandidateEngagementRequest({
        request,
        sessionId,
        ...createDefaultCandidateEngagementDependencies(),
    });
}

export async function handleCandidateEngagementRequest({
    request,
    sessionId,
    reportingEnabled = false,
    now = () => new Date(),
    resolveCandidateSessionIdentity,
    engagementRepository,
}: CandidateEngagementRouteDependencies & { request: Request; sessionId: string }) {
    if (!reportingEnabled) {
        return Response.json({ error: "Candidate engagement reporting is unavailable." }, { status: 404 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return invalidRequest();
    }
    const slices = parseCandidateEngagementBatch(body, now());
    if (!slices) return invalidRequest();

    const identity = resolveCandidateSessionIdentity
        ? await resolveCandidateSessionIdentity(request)
        : null;
    if (!identity || !engagementRepository) {
        return Response.json({ error: "Candidate session identity is required." }, { status: 401 });
    }

    const result = await engagementRepository.appendSlices({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        slices,
    });
    if (!result.sessionOwned) {
        return Response.json({ error: "Candidate session engagement could not be saved." }, { status: 404 });
    }

    return Response.json({
        status: "engagement_saved",
        acceptedSliceCount: result.acceptedSliceCount,
        summary: {
            activeMilliseconds: result.activeMilliseconds,
            sliceCount: result.sliceCount,
            firstReceivedAt: result.firstReceivedAt,
            lastReceivedAt: result.lastReceivedAt,
        },
    });
}

function createDefaultCandidateEngagementDependencies(): CandidateEngagementRouteDependencies {
    const reportingEnabled = isCandidateEngagementReportingEnabled(process.env);
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!reportingEnabled || !databaseUrl) return { reportingEnabled };

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    return {
        reportingEnabled,
        resolveCandidateSessionIdentity: (request) =>
            resolveCandidateOwnedRequestIdentity(request, queryClient),
        engagementRepository: createCandidateEngagementRepository(queryClient),
    };
}

export function parseCandidateEngagementBatch(value: unknown, now: Date): CandidateEngagementSlice[] | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const body = value as Record<string, unknown>;
    if (!Array.isArray(body.slices) || body.slices.length < 1 || body.slices.length > MAX_BATCH_SIZE) {
        return null;
    }
    if (Object.keys(body).some((key) => key !== "slices")) return null;

    const slices = body.slices.map((slice) => parseSlice(slice, now));
    if (slices.some((slice) => !slice)) return null;
    const parsed = slices as CandidateEngagementSlice[];
    const sliceIds = new Set(parsed.map((slice) => slice.engagementSliceId));
    const sequences = new Set(parsed.map((slice) => `${slice.trackerInstanceId}:${slice.sequenceNumber}`));
    return sliceIds.size === parsed.length && sequences.size === parsed.length ? parsed : null;
}

function parseSlice(value: unknown, now: Date): CandidateEngagementSlice | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const slice = value as Record<string, unknown>;
    const allowedKeys = new Set([
        "engagementSliceId",
        "trackerInstanceId",
        "sequenceNumber",
        "activeMilliseconds",
        "clientStartedAt",
        "clientEndedAt",
        "openedBy",
        "lastActivity",
        "flushReason",
    ]);
    if (Object.keys(slice).some((key) => !allowedKeys.has(key))) return null;
    if (!isUuid(slice.engagementSliceId) || !isUuid(slice.trackerInstanceId)) return null;
    if (!isIntegerBetween(slice.sequenceNumber, 1, 2_147_483_647)) return null;
    if (!isIntegerBetween(slice.activeMilliseconds, 1, 60_000)) return null;
    if (!isCandidateEngagementOpenReason(slice.openedBy)) return null;
    if (!isCandidateEngagementActivityReason(slice.lastActivity)) return null;
    if (!isCandidateEngagementFlushReason(slice.flushReason)) return null;

    const startedAt = readTimestamp(slice.clientStartedAt);
    const endedAt = readTimestamp(slice.clientEndedAt);
    if (startedAt === null || endedAt === null || endedAt < startedAt || endedAt - startedAt > MAX_INTERVAL_MS) {
        return null;
    }
    const nowMs = now.valueOf();
    if (endedAt < nowMs - MAX_PAST_AGE_MS || endedAt > nowMs + MAX_FUTURE_SKEW_MS) return null;
    if ((slice.activeMilliseconds as number) > endedAt - startedAt + 2_000) return null;

    return {
        engagementSliceId: slice.engagementSliceId,
        trackerInstanceId: slice.trackerInstanceId,
        sequenceNumber: slice.sequenceNumber,
        activeMilliseconds: slice.activeMilliseconds,
        clientStartedAt: new Date(startedAt).toISOString(),
        clientEndedAt: new Date(endedAt).toISOString(),
        openedBy: slice.openedBy,
        lastActivity: slice.lastActivity,
        flushReason: slice.flushReason,
    } as CandidateEngagementSlice;
}

function invalidRequest() {
    return Response.json({ error: "Invalid candidate engagement request." }, { status: 400 });
}

function isUuid(value: unknown): value is string {
    return typeof value === "string"
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function readTimestamp(value: unknown) {
    if (typeof value !== "string") return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

type CandidateEngagementQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateEngagementQueryClient {
    let pool: import("pg").Pool | null = null;
    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-engagement",
            });
            return pool.query(sql, values);
        },
    };
}

function getRuntimeSslConfig(databaseUrl: string) {
    try {
        const sslMode = new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase();
        if (sslMode === "disable") return false;
        if (sslMode) return { rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full" };
    } catch {
        return undefined;
    }
    return undefined;
}
