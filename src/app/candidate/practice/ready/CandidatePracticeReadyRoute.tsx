import Link from "next/link";
import { ArrowLeft, ListChecks, Play } from "lucide-react";

import { resolveCandidateOwnedCookieIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidatePracticeSessionRepository,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    createCandidateBaselineAwarePracticeSessions,
    createCandidatePracticePlanBaselineRepository,
} from "@/features/candidate-setup-v2/candidate-practice-plan-baseline-repository";
import {
    parseCandidateFollowUpPracticeIntent,
    resolveCandidateFollowUpPracticeIntent,
    type CandidateFollowUpPracticeIntent,
    type CandidatePracticeReadySearchParams,
    type CandidateResolvedFollowUpPracticeIntent,
} from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";

type CandidatePracticeReadyPageProps = {
    searchParams?: Promise<CandidatePracticeReadySearchParams> | CandidatePracticeReadySearchParams;
    authorizedCandidateProfileId?: string;
};

export default async function CandidatePracticeReadyPage({
    searchParams,
    authorizedCandidateProfileId,
}: CandidatePracticeReadyPageProps = {}) {
    const resolvedSearchParams = await searchParams;
    return renderCandidatePracticeReadyPage({
        searchParams: resolvedSearchParams,
        dependencies: createDefaultCandidatePracticeReadyPageDependencies(
            resolvedSearchParams,
            authorizedCandidateProfileId,
        ),
    });
}

type CandidatePracticeReadyPageDependencies = {
    resolveFollowUpPracticeIntent?: (
        intent: CandidateFollowUpPracticeIntent,
    ) => Promise<CandidateResolvedFollowUpPracticeIntent | null>;
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
    authorizedCandidateProfileId?: string,
): CandidatePracticeReadyPageDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const practicePlanBaselineRepository = createCandidatePracticePlanBaselineRepository(queryClient);

    return {
        async resolveFollowUpPracticeIntent(intent) {
            try {
                const candidateProfileId = authorizedCandidateProfileId
                    ?? await resolveCandidatePracticeReadyProfileIdFromCurrentRequest(queryClient);

                if (!candidateProfileId) {
                    return null;
                }

                const sourceSession = await practiceSessionRepository.findSetupSession({
                    candidateProfileId,
                    candidatePracticeSessionId: intent.source.candidatePracticeSessionId,
                });
                const practicePlanBaseline = sourceSession?.roleProfileId
                    ? await practicePlanBaselineRepository.findForCandidateRoleProfile({
                        candidateProfileId,
                        roleProfileId: sourceSession.roleProfileId,
                    })
                    : null;

                return resolveCandidateFollowUpPracticeIntent({
                    intent,
                    candidateProfileId,
                    practiceSessions: createCandidateBaselineAwarePracticeSessions({
                        practiceSessions: sourceSession ? [sourceSession] : [],
                        baseline: practicePlanBaseline,
                    }),
                    selectedRoleProfileId: readSearchParam(searchParams?.prep),
                    selectedLegacyTargetRole: readSearchParam(searchParams?.targetRole),
                });
            } catch {
                return null;
            }
        },
    };
}

async function resolveCandidatePracticeReadyProfileIdFromCurrentRequest(
    client: CandidatePracticeReadyQueryClient,
) {
    const { headers } = await import("next/headers");
    const requestHeaders = await headers();
    return resolveCandidateProfileIdFromRequestHeaders(
        requestHeaders.get("cookie"),
        client,
    );
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
    const identity = await resolveCandidateOwnedCookieIdentity(cookieHeader, client);
    return identity?.candidateProfileId ?? null;
}

function readSearchParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }
    return value ?? null;
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
