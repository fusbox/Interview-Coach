import { ArrowRight, ChevronDown, ClipboardList, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidateDashboardV2ReadModel,
    type CandidateDashboardV2ReadModel,
} from "@/features/candidate-dashboard-v2/candidate-dashboard-read-model";
import { createCandidateCoachUpdateArtifactRepository } from "@/features/candidate-dashboard-v2/candidate-coach-update-artifact-repository";
import { CandidateDashboardPriorityExperience } from "@/features/candidate-dashboard-v2/CandidateDashboardPriorityExperience";
import {
    CandidateNextRoundBuilderExperience,
    CandidateNextRoundBuilderTrigger,
} from "@/features/candidate-dashboard-v2/CandidateNextRoundBuilderExperience";
import {
    createCandidateDashboardHref,
    normalizeCandidateRoleProfileId,
    normalizeCandidateTargetInterviewId,
} from "@/features/candidate-dashboard-v2/candidate-dashboard-route";
import {
    createCandidatePracticeSessionRepository,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { createCandidateAnswerHistoryRepository } from "@/features/candidate-session-v2/candidate-answer-history-repository";
import { parseAcceptedEvidenceFirstEvaluatorRun } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";
import { createCandidatePracticePlanBaselineRepository } from "@/features/candidate-setup-v2/candidate-practice-plan-baseline-repository";
import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";
import { createCandidateNextRoundRuntime } from "@/features/candidate-practice-v2/candidate-next-round-runtime";

type CandidateDashboardPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CandidateDashboardPage({ searchParams }: CandidateDashboardPageProps = {}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};

    return renderCandidateDashboardPage({
        dependencies: createDefaultCandidateDashboardPageDependencies(),
        selectedRoleProfileId: readSearchParam(resolvedSearchParams.prep),
        selectedLegacyTargetRole: readSearchParam(resolvedSearchParams.targetRole),
        canonicalizeSelection: true,
    });
}

type CandidateDashboardPageDependencies = {
    resolveDashboardModel?: (input: {
        selectedRoleProfileId?: string | null;
        selectedLegacyTargetRole?: string | null;
    }) => Promise<CandidateDashboardV2ReadModel | null>;
    resolveNextRoundBuilder?: (input: {
        candidateProfileId: string;
        roleProfileId: string;
    }) => Promise<CandidateNextRoundBuilderModel | null>;
};

export async function renderCandidateDashboardPage({
    dependencies = {},
    selectedRoleProfileId = null,
    selectedLegacyTargetRole = null,
    canonicalizeSelection = false,
}: {
    dependencies?: CandidateDashboardPageDependencies;
    selectedRoleProfileId?: string | null;
    selectedLegacyTargetRole?: string | null;
    canonicalizeSelection?: boolean;
}) {
    const dashboard = dependencies.resolveDashboardModel
        ? await dependencies.resolveDashboardModel({ selectedRoleProfileId, selectedLegacyTargetRole })
        : null;

    if (canonicalizeSelection && dashboard?.selectedTargetInterview) {
        const requestedHref = createCandidateDashboardHrefFromRequest({
            selectedRoleProfileId,
            selectedLegacyTargetRole,
        });
        const selectedHref = createCandidateDashboardTargetInterviewHref(dashboard.selectedTargetInterview);
        if (requestedHref !== selectedHref) {
            redirect(selectedHref);
        }
    }

    let nextRoundBuilder: CandidateNextRoundBuilderModel | null = null;
    const roleProfileId = dashboard?.selectedTargetInterview?.roleProfileId ?? null;
    if (dashboard && roleProfileId && dependencies.resolveNextRoundBuilder) {
        try {
            nextRoundBuilder = await dependencies.resolveNextRoundBuilder({
                candidateProfileId: dashboard.candidateProfileId,
                roleProfileId,
            });
        } catch {
            nextRoundBuilder = null;
        }
    }

    return <CandidateDashboardHome dashboard={dashboard} nextRoundBuilder={nextRoundBuilder} />;
}

function CandidateDashboardHome({
    dashboard,
    nextRoundBuilder,
}: {
    dashboard: CandidateDashboardV2ReadModel | null;
    nextRoundBuilder: CandidateNextRoundBuilderModel | null;
}) {
    const hasSelectedContext = Boolean(dashboard?.selectedTargetInterview);
    const page = (
        <main className="candidate-dashboard-page">
            <CandidateDashboardShellHeader dashboard={dashboard} hasNextRoundBuilder={Boolean(nextRoundBuilder)} />
            <section className="candidate-dashboard-shell">
                {dashboard && hasSelectedContext ? (
                    <CandidateDashboardLearningLoop dashboard={dashboard} />
                ) : (
                    <CandidateDashboardEmptyState />
                )}
            </section>
        </main>
    );

    return nextRoundBuilder ? (
        <CandidateNextRoundBuilderExperience initialBuilder={nextRoundBuilder}>
            {page}
        </CandidateNextRoundBuilderExperience>
    ) : page;
}

function CandidateDashboardShellHeader({
    dashboard,
    hasNextRoundBuilder,
}: {
    dashboard: CandidateDashboardV2ReadModel | null;
    hasNextRoundBuilder: boolean;
}) {
    const displayName = dashboard?.candidate.displayName;
    const email = dashboard?.candidate.email;
    const selectedTargetInterview = dashboard?.selectedTargetInterview ?? null;
    const alternateTargetInterviews = dashboard?.targetInterviews.filter((targetInterview) => !targetInterview.isSelected) ?? [];

    return (
        <header className="candidate-dashboard-topbar" aria-label="Dashboard header">
            <div className="candidate-dashboard-topbar__inner app-grid">
                <div
                    className="candidate-dashboard-identity"
                    role="img"
                    aria-label={`Signed in as ${displayName || email || "candidate"}`}
                >
                    {getCandidateInitials(displayName, email)}
                </div>

                {selectedTargetInterview ? (
                    <details className="candidate-dashboard-context-menu">
                        <summary>
                            <span>
                                <span className="candidate-dashboard-context-menu__label">Preparing for</span>
                                <strong>{selectedTargetInterview.targetRole}</strong>
                            </span>
                            <ChevronDown size={18} aria-hidden="true" />
                        </summary>
                        <div className="candidate-dashboard-context-menu__popover">
                            <p className="type-eyebrow">Your prep contexts</p>
                            <div className="candidate-dashboard-context-menu__current" aria-current="page">
                                <strong>{selectedTargetInterview.targetRole}</strong>
                                <span>{formatTargetInterviewProgress(selectedTargetInterview)}</span>
                            </div>
                            {alternateTargetInterviews.map((targetInterview) => (
                                <a
                                    key={targetInterview.id}
                                    href={createCandidateDashboardTargetInterviewHref(targetInterview)}
                                >
                                    <strong>{targetInterview.targetRole}</strong>
                                    <span>{formatTargetInterviewProgress(targetInterview)}</span>
                                </a>
                            ))}
                            <a className="candidate-dashboard-context-menu__new" href="/candidate/setup">
                                <Plus size={17} aria-hidden="true" />
                                <span>Prep for a new role</span>
                            </a>
                        </div>
                    </details>
                ) : <span className="candidate-dashboard-topbar__spacer" />}

                {hasNextRoundBuilder ? (
                    <CandidateNextRoundBuilderTrigger />
                ) : (
                    <a
                        className="candidate-dashboard-next-link"
                        href={selectedTargetInterview ? "#practice-next" : "/candidate/setup"}
                    >
                        {selectedTargetInterview
                            ? <ClipboardList size={18} aria-hidden="true" />
                            : <Plus size={18} aria-hidden="true" />}
                        <span>{selectedTargetInterview ? "Practice next" : "Set up practice"}</span>
                    </a>
                )}
            </div>
        </header>
    );
}

function CandidateDashboardLearningLoop({ dashboard }: { dashboard: CandidateDashboardV2ReadModel }) {
    const selectedTargetInterview = dashboard.selectedTargetInterview;

    return (
        <div className="candidate-dashboard-content">
            <header className="candidate-dashboard-intro">
                <p className="candidate-dashboard-intro__label">Practice home</p>
                <h1>{selectedTargetInterview?.targetRole ?? "Your interview practice"}</h1>
                <p>
                    Continue your practice, review what I noticed, and choose what to work on next.
                </p>
            </header>

            <CandidateDashboardPriorityExperience dashboard={dashboard} />
        </div>
    );
}

function createCandidateDashboardTargetInterviewHref(
    targetInterview: CandidateDashboardV2ReadModel["targetInterviews"][number],
) {
    return targetInterview.roleProfileId
        ? createCandidateDashboardHref({ roleProfileId: targetInterview.roleProfileId })
        : createCandidateDashboardHref({ legacyTargetRole: targetInterview.id });
}

function createCandidateDashboardHrefFromRequest({
    selectedRoleProfileId,
    selectedLegacyTargetRole,
}: {
    selectedRoleProfileId?: string | null;
    selectedLegacyTargetRole?: string | null;
}) {
    if (selectedRoleProfileId?.trim()) {
        const roleProfileId = normalizeCandidateRoleProfileId(selectedRoleProfileId);
        return roleProfileId
            ? createCandidateDashboardHref({ roleProfileId })
            : createCandidateDashboardHref();
    }

    const legacyTargetRole = normalizeCandidateTargetInterviewId(selectedLegacyTargetRole);
    return legacyTargetRole
        ? createCandidateDashboardHref({ legacyTargetRole })
        : createCandidateDashboardHref();
}

function formatTargetInterviewProgress(targetInterview: CandidateDashboardV2ReadModel["targetInterviews"][number]) {
    const roundLabel = targetInterview.activeRoundCount > 0
        ? `${targetInterview.activeRoundCount} active`
        : `${targetInterview.completedRoundCount} completed`;
    const answerLabel = `${targetInterview.answeredQuestionCount} answered`;
    return `${roundLabel} - ${answerLabel}`;
}

function getCandidateInitials(displayName?: string | null, email?: string | null) {
    const source = displayName?.trim() || email?.trim() || "Candidate";
    const nameParts = source
        .replace(/@.*/, "")
        .split(/\s+/)
        .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
        .filter(Boolean);

    if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }

    return (nameParts[0] || "C").slice(0, 2).toUpperCase();
}

function CandidateDashboardEmptyState() {
    return (
        <section className="candidate-dashboard-empty" aria-label="No completed practice rounds">
            <p className="type-eyebrow">Coach Plan</p>
            <h1>Build your first practice plan.</h1>
            <p>
                Start with the role and interview you are preparing for. I will use that context to shape your first round and what comes next.
            </p>
            <a className="candidate-dashboard-action" href="/candidate/setup">
                Set up practice
                <ArrowRight size={16} aria-hidden="true" />
            </a>
        </section>
    );
}

function createDefaultCandidateDashboardPageDependencies(): CandidateDashboardPageDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const answerHistoryRepository = createCandidateAnswerHistoryRepository(queryClient);
    const practicePlanBaselineRepository = createCandidatePracticePlanBaselineRepository(queryClient);
    const coachUpdateArtifactRepository = createCandidateCoachUpdateArtifactRepository(queryClient);
    const nextRoundRuntime = createCandidateNextRoundRuntime(databaseUrl);

    return {
        async resolveDashboardModel({ selectedRoleProfileId, selectedLegacyTargetRole }) {
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

                const normalizedSelectedRoleProfileId = normalizeCandidateRoleProfileId(selectedRoleProfileId);
                const [
                    candidatePracticeSessions,
                    selectedContextSessions,
                    coachUpdateArtifacts,
                    candidateIdentity,
                    practicePlanBaselines,
                    answerAttempts,
                    evaluationRuns,
                ] = await Promise.all([
                    practiceSessionRepository.listAllPracticeSessionsForCandidate({ candidateProfileId }),
                    normalizedSelectedRoleProfileId
                        ? practiceSessionRepository.listPracticeSessionsForCandidateRoleProfile({
                            candidateProfileId,
                            roleProfileId: normalizedSelectedRoleProfileId,
                        })
                        : Promise.resolve([]),
                    coachUpdateArtifactRepository.listLatestArtifactAttempts({ candidateProfileId }),
                    readCandidateDashboardIdentity(queryClient, candidateProfileId),
                    practicePlanBaselineRepository.listForCandidate({ candidateProfileId }),
                    answerHistoryRepository
                        .listAnswerAttemptsForCandidate({ candidateProfileId })
                        .catch(() => null),
                    answerHistoryRepository.listEvaluationRunsForCandidate({
                        candidateProfileId,
                        purpose: "candidate_coaching",
                    }).catch(() => null),
                ]);
                const practiceSessions = mergeCandidatePracticeSessions(
                    candidatePracticeSessions,
                    selectedContextSessions,
                );

                return createCandidateDashboardV2ReadModel({
                    candidateProfileId,
                    practiceSessions,
                    coachUpdateArtifacts,
                    candidateIdentity,
                    practicePlanBaselines,
                    answerAttempts,
                    acceptedEvaluationRuns: evaluationRuns?.flatMap((run) => {
                        if (run.lifecycleState !== "completed" || !run.result || !run.completedAt) {
                            return [];
                        }
                        const accepted = parseAcceptedEvidenceFirstEvaluatorRun(run.result);
                        if (
                            !accepted
                            || accepted.evaluationRunId !== run.candidateAnswerEvaluationRunId
                            || accepted.inputFingerprint !== run.inputFingerprint
                        ) {
                            return [];
                        }
                        return [{
                            candidateAnswerAttemptId: run.candidateAnswerAttemptId,
                            candidateAnswerEvaluationRunId: run.candidateAnswerEvaluationRunId,
                            completedAt: run.completedAt,
                            extraction: {
                                answerUsability: accepted.accepted.extraction.answerUsability,
                                technicalAccuracy: accepted.accepted.extraction.technicalAccuracy,
                            },
                            criteria: accepted.accepted.criteria,
                        }];
                    }) ?? null,
                    selectedRoleProfileId,
                    selectedLegacyTargetRole,
                });
            } catch {
                return null;
            }
        },
        resolveNextRoundBuilder: nextRoundRuntime.loadBuilder,
    };
}

function mergeCandidatePracticeSessions(
    candidateSessions: Awaited<ReturnType<ReturnType<typeof createCandidatePracticeSessionRepository>["listAllPracticeSessionsForCandidate"]>>,
    selectedContextSessions: Awaited<ReturnType<ReturnType<typeof createCandidatePracticeSessionRepository>["listPracticeSessionsForCandidateRoleProfile"]>>,
) {
    const sessionsById = new Map(candidateSessions.map((session) => [session.candidatePracticeSessionId, session]));
    for (const session of selectedContextSessions) {
        sessionsById.set(session.candidatePracticeSessionId, session);
    }
    return Array.from(sessionsById.values());
}

async function readCandidateDashboardIdentity(
    client: CandidateDashboardQueryClient,
    candidateProfileId: string,
) {
    const result = await client.query(`
        select display_name, email
        from public.candidate_profiles
        where candidate_profile_id = $1
          and status = 'active'
        limit 1
    `, [candidateProfileId]);

    return {
        displayName: readString(result.rows[0]?.display_name),
        email: readString(result.rows[0]?.email),
    };
}

function readSearchParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }
    return value ?? null;
}

type CandidateDashboardQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateDashboardQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getCandidateDashboardRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-dashboard",
            });
            return pool.query(sql, values);
        },
    };
}

async function resolveCandidateProfileIdFromRequestHeaders(
    cookieHeader: string | null,
    client: CandidateDashboardQueryClient,
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

export function getCandidateDashboardRuntimeSslConfig(databaseUrl: string) {
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
