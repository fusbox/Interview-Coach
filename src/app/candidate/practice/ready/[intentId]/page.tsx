import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidatePracticeIntentRepository,
} from "@/features/candidate-practice-v2/candidate-practice-intent-repository";
import type {
    CandidatePracticeIntentRecord,
} from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import { CandidatePreSessionLanding } from "@/features/candidate-session-v2/CandidatePreSessionLanding";
import { candidateSetupStageOptions } from "@/features/candidate-setup-v2/candidate-setup-contract";

type CandidatePracticeIntentReadyPageProps = {
    params: Promise<{ intentId: string }> | { intentId: string };
};

export default async function CandidatePracticeIntentReadyPage({
    params,
}: CandidatePracticeIntentReadyPageProps) {
    const { intentId } = await params;
    return renderCandidatePracticeIntentReadyPage({
        intentId,
        dependencies: createDefaultCandidatePracticeIntentReadyPageDependencies(),
    });
}

type CandidatePracticeIntentReadyPageDependencies = {
    resolvePracticeIntent?: (intentId: string) => Promise<CandidatePracticeIntentRecord | null>;
};

export async function renderCandidatePracticeIntentReadyPage({
    intentId,
    dependencies = {},
}: {
    intentId: string;
    dependencies?: CandidatePracticeIntentReadyPageDependencies;
}) {
    const practiceIntent = dependencies.resolvePracticeIntent
        ? await dependencies.resolvePracticeIntent(intentId)
        : null;

    if (!practiceIntent || practiceIntent.lifecycleState !== "ready") {
        return <PracticeIntentReadyRecoveryState />;
    }

    return <PracticeIntentReadyResolvedState intent={practiceIntent} />;
}

function PracticeIntentReadyResolvedState({ intent }: { intent: CandidatePracticeIntentRecord }) {
    return (
        <CandidatePreSessionLanding
            variant="follow_up"
            targetRole={intent.targetRole}
            stageLabel={candidateSetupStageOptions.find((stage) => stage.id === intent.setupContext.interviewStage)?.label ?? "Interview"}
            questionCount={intent.itemCount}
            resumeIncluded={intent.setupContext.resumeIncluded}
            questions={intent.items.map((item) => ({
                id: `${item.source.candidatePracticeSessionId}:${item.source.questionKey}`,
                number: item.source.questionNumber,
                category: item.source.category,
                questionText: item.source.questionText,
            }))}
            startActionUrl={`/candidate/practice/ready/${intent.candidatePracticeIntentId}/start`}
            returnHref="/candidate/dashboard"
        />
    );
}

function PracticeIntentReadyRecoveryState() {
    return (
        <main className="candidate-practice-ready-page candidate-app-shell">
            <section className="candidate-practice-ready-page__hero">
                <p className="type-eyebrow">Follow-up practice</p>
                <h1>Practice round is not ready yet.</h1>
                <p>I could not confirm the practice items for this round. Return to your Coach Plan and choose a practice action again.</p>
            </section>

            <Link className="candidate-button candidate-button--primary" href="/candidate/dashboard">
                <ArrowLeft size={16} />
                Return to Coach Plan
            </Link>
        </main>
    );
}

function createDefaultCandidatePracticeIntentReadyPageDependencies(): CandidatePracticeIntentReadyPageDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceIntentRepository = createCandidatePracticeIntentRepository(queryClient);

    return {
        async resolvePracticeIntent(intentId) {
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

                return practiceIntentRepository.findPracticeIntent({
                    candidatePracticeIntentId: intentId,
                    candidateProfileId,
                });
            } catch {
                return null;
            }
        },
    };
}

type CandidatePracticeIntentReadyQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidatePracticeIntentReadyQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getCandidatePracticeIntentReadyRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-practice-intent-ready",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateProfileIdFromRequestHeaders(
    cookieHeader: string | null,
    client: CandidatePracticeIntentReadyQueryClient,
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

function getCandidatePracticeIntentReadyRuntimeSslConfig(databaseUrl: string) {
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
