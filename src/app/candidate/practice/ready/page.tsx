import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ListChecks, Play } from "lucide-react";

import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidatePracticeSessionRepository,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    createCandidatePracticeIntentRepository,
} from "@/features/candidate-practice-v2/candidate-practice-intent-repository";
import {
    createCandidatePracticeIntentFromResolvedItems,
    type CandidatePracticeIntentCreationResult,
} from "@/features/candidate-practice-v2/candidate-practice-intent-creation";
import {
    parseCandidateFollowUpPracticeIntent,
    resolveCandidateFollowUpPracticeIntent,
    type CandidateFollowUpPracticeIntent,
    type CandidatePracticeReadySearchParams,
    type CandidateResolvedFollowUpPracticeIntent,
} from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";

type CandidatePracticeReadyPageProps = {
    searchParams?: Promise<CandidatePracticeReadySearchParams> | CandidatePracticeReadySearchParams;
};

export default async function CandidatePracticeReadyPage({ searchParams }: CandidatePracticeReadyPageProps = {}) {
    const resolvedSearchParams = await searchParams;
    return renderCandidatePracticeReadyPage({
        searchParams: resolvedSearchParams,
        dependencies: createDefaultCandidatePracticeReadyPageDependencies(resolvedSearchParams),
    });
}

type CandidatePracticeReadyPageDependencies = {
    resolveFollowUpPracticeIntent?: (
        intent: CandidateFollowUpPracticeIntent,
    ) => Promise<CandidateResolvedFollowUpPracticeIntent | null>;
    createPracticeIntent?: (
        intent: CandidateResolvedFollowUpPracticeIntent,
    ) => Promise<CandidatePracticeIntentCreationResult>;
};

export async function renderCandidatePracticeReadyPage({
    searchParams,
    dependencies = {},
}: {
    searchParams?: CandidatePracticeReadySearchParams | null;
    dependencies?: CandidatePracticeReadyPageDependencies;
}) {
    const parsedIntent = parseCandidateFollowUpPracticeIntent(searchParams);
    const resolvedIntent = parsedIntent && dependencies.resolveFollowUpPracticeIntent
        ? await dependencies.resolveFollowUpPracticeIntent(parsedIntent)
        : null;

    if (!resolvedIntent) {
        return <PracticeReadyRecoveryState />;
    }

    if (dependencies.createPracticeIntent) {
        const createdIntent = await dependencies.createPracticeIntent(resolvedIntent);
        if (createdIntent.status === "candidate_practice_intent_created") {
            redirect(createdIntent.redirectTo);
        }

        return <PracticeReadyRecoveryState />;
    }

    return <PracticeReadyResolvedState intent={resolvedIntent} />;
}

function PracticeReadyResolvedState({ intent }: { intent: CandidateResolvedFollowUpPracticeIntent }) {
    return (
        <main className="candidate-practice-ready-page candidate-app-shell">
            <section className="candidate-practice-ready-page__hero">
                <p className="type-eyebrow">Follow-up practice</p>
                <h1>Ready for focused practice.</h1>
                <p>{intent.display.body} This round will stay scoped to the practice item you chose.</p>
            </section>

            <section className="candidate-practice-ready-card" aria-label="Follow-up practice details">
                <div className="candidate-practice-ready-card__icon" aria-hidden="true">
                    <ListChecks size={22} />
                </div>
                <div className="candidate-practice-ready-card__content">
                    <p className="type-eyebrow">{intent.display.label}</p>
                    <h2>{intent.source.targetRole}</h2>
                    <p className="candidate-practice-ready-card__meta">
                        Question {intent.source.questionNumber} - {intent.source.category}
                    </p>
                    <p>{intent.source.questionText}</p>
                </div>
            </section>

            <section className="candidate-practice-ready-actions" aria-label="Practice actions">
                <button className="candidate-button candidate-button--primary" type="button" disabled>
                    <Play size={16} />
                    Start focused practice
                </button>
                <Link className="candidate-button candidate-button--secondary" href="/candidate/dashboard">
                    <ArrowLeft size={16} />
                    Return to Coach Plan
                </Link>
            </section>
        </main>
    );
}

function PracticeReadyRecoveryState() {
    return (
        <main className="candidate-practice-ready-page candidate-app-shell">
            <section className="candidate-practice-ready-page__hero">
                <p className="type-eyebrow">Follow-up practice</p>
                <h1>Practice round is not ready yet.</h1>
                <p>I could not confirm the practice item for this round. Return to your Coach Plan and choose a practice action again.</p>
            </section>

            <Link className="candidate-button candidate-button--primary" href="/candidate/dashboard">
                <ArrowLeft size={16} />
                Return to Coach Plan
            </Link>
        </main>
    );
}

function createDefaultCandidatePracticeReadyPageDependencies(
    searchParams: CandidatePracticeReadySearchParams | null | undefined,
): CandidatePracticeReadyPageDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const practiceIntentRepository = createCandidatePracticeIntentRepository(queryClient);

    return {
        async resolveFollowUpPracticeIntent(intent) {
            try {
                const { headers } = await import("next/headers");
                const requestHeaders = await headers();
                const candidateProfileId = await resolveCandidateProfileIdFromRequestHeaders(
                    requestHeaders.get("cookie"),
                    queryClient,
                );

                if (!candidateProfileId) {
                    return null;
                }

                const practiceSessions = await practiceSessionRepository.listPracticeSessionsForCandidate({
                    candidateProfileId,
                    limit: 50,
                });

                return resolveCandidateFollowUpPracticeIntent({
                    intent,
                    candidateProfileId,
                    practiceSessions,
                    selectedTargetInterviewId: readSearchParam(searchParams?.targetRole),
                });
            } catch {
                return null;
            }
        },
        async createPracticeIntent(intent) {
            try {
                const { headers } = await import("next/headers");
                const requestHeaders = await headers();
                const candidateProfileId = await resolveCandidateProfileIdFromRequestHeaders(
                    requestHeaders.get("cookie"),
                    queryClient,
                );

                if (!candidateProfileId) {
                    return {
                        status: "candidate_practice_intent_not_created",
                        reason: "persistence_failed",
                    };
                }

                return createCandidatePracticeIntentFromResolvedItems({
                    candidateProfileId,
                    source: "coach_update_detail",
                    resolvedItems: [intent],
                    practiceIntentRepository,
                });
            } catch {
                return {
                    status: "candidate_practice_intent_not_created",
                    reason: "persistence_failed",
                };
            }
        },
    };
}

type CandidatePracticeReadyQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidatePracticeReadyQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getCandidatePracticeReadyRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-practice-ready",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateProfileIdFromRequestHeaders(
    cookieHeader: string | null,
    client: CandidatePracticeReadyQueryClient,
) {
    const devIdentity = resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
    if (devIdentity) {
        return devIdentity.candidateProfileId;
    }

    const candidateLaunchSessionId = readCookieValue(cookieHeader, CANDIDATE_HOST_LAUNCH_SESSION_COOKIE);
    if (!candidateLaunchSessionId) {
        return null;
    }

    const result = await client.query(`
        select candidate_profile_id
        from public.candidate_launch_sessions
        where candidate_launch_session_id = $1
          and revoked_at is null
          and expires_at > now()
        limit 1
    `, [candidateLaunchSessionId]);

    return readString(result.rows[0]?.candidate_profile_id);
}

function readSearchParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }
    return value ?? null;
}

function readCookieValue(cookieHeader: string | null, name: string) {
    if (!cookieHeader) {
        return null;
    }

    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getCandidatePracticeReadyRuntimeSslConfig(databaseUrl: string) {
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
