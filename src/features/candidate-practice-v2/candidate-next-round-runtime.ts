import { resolveCandidateOwnedCookieIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    createCandidateBaselineAwarePracticeSessions,
    createCandidatePracticePlanBaselineRepository,
} from "@/features/candidate-setup-v2/candidate-practice-plan-baseline-repository";

import {
    loadCandidateNextRoundBuilder,
    mutateCandidateNextRoundBuilder,
    type CandidateNextRoundBuilderMutation,
} from "./candidate-next-round-builder-service";
import { launchCandidateNextRoundDraft } from "./candidate-next-round-draft-launch";
import { createCandidateNextRoundDraftLaunchRepository } from "./candidate-next-round-draft-launch-repository";
import { createCandidateNextRoundDraftRepository } from "./candidate-next-round-draft-repository";

export type CandidateNextRoundRuntimeQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export function createCandidateNextRoundRuntime(databaseUrl: string) {
    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const draftRepository = createCandidateNextRoundDraftRepository(queryClient);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const practicePlanBaselineRepository = createCandidatePracticePlanBaselineRepository(queryClient);
    const launchRepository = createCandidateNextRoundDraftLaunchRepository(queryClient);

    return {
        queryClient,
        loadBuilder(input: { candidateProfileId: string; roleProfileId: string }) {
            return loadCandidateNextRoundBuilder({
                ...input,
                draftRepository,
                practiceSessionRepository,
                practicePlanBaselineRepository,
            });
        },
        mutateBuilder(input: {
            candidateProfileId: string;
            roleProfileId: string;
            candidateNextRoundDraftId: string;
            expectedVersion: number;
            mutation: CandidateNextRoundBuilderMutation;
        }) {
            return mutateCandidateNextRoundBuilder({
                ...input,
                draftRepository,
                practiceSessionRepository,
                practicePlanBaselineRepository,
            });
        },
        async launchBuilder(input: {
            candidateProfileId: string;
            roleProfileId: string;
            candidateNextRoundDraftId: string;
            expectedVersion: number;
        }) {
            const [practiceSessions, practicePlanBaseline] = await Promise.all([
                practiceSessionRepository.listPracticeSessionsForCandidateRoleProfile({
                    candidateProfileId: input.candidateProfileId,
                    roleProfileId: input.roleProfileId,
                }),
                practicePlanBaselineRepository.findForCandidateRoleProfile({
                    candidateProfileId: input.candidateProfileId,
                    roleProfileId: input.roleProfileId,
                }),
            ]);
            return launchCandidateNextRoundDraft({
                ...input,
                practiceSessions: createCandidateBaselineAwarePracticeSessions({
                    practiceSessions,
                    baseline: practicePlanBaseline,
                }),
                draftRepository,
                launchRepository,
            });
        },
    };
}

export async function resolveCandidateNextRoundProfileId(
    cookieHeader: string | null,
    client: CandidateNextRoundRuntimeQueryClient,
) {
    const identity = await resolveCandidateOwnedCookieIdentity(cookieHeader, client);
    return identity?.candidateProfileId ?? null;
}

function createLazyPostgresQueryClient(databaseUrl: string): CandidateNextRoundRuntimeQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-next-round",
            });
            return pool.query(sql, values);
        },
    };
}

function getRuntimeSslConfig(databaseUrl: string) {
    const sslMode = readUrlSslMode(databaseUrl);
    if (sslMode === "disable") {
        return false;
    }
    if (sslMode) {
        return {
            rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full",
        };
    }
    return undefined;
}

function readUrlSslMode(databaseUrl: string) {
    try {
        return new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase() ?? null;
    } catch {
        return null;
    }
}
