import { ArrowRight, Briefcase, ChevronDown, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { InterviewCoachBrandMark } from "@/features/brand-v2/InterviewCoachBrandMark";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { resolveCandidateOwnedCookieIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidateDashboardV2ReadModel,
    type CandidateDashboardV2ReadModel,
} from "@/features/candidate-dashboard-v2/candidate-dashboard-read-model";
import { createCandidateCoachUpdateArtifactRepository } from "@/features/candidate-dashboard-v2/candidate-coach-update-artifact-repository";
import { CandidateDashboardCoachDeskExperience } from "@/features/candidate-dashboard-v2/CandidateDashboardCoachDeskExperience";
import {
    CandidateNextRoundBuilderExperience,
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
import { parseCompatiblePersistedAcceptedEvidenceFirstEvaluatorRun } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";
import { createCandidatePracticePlanBaselineRepository } from "@/features/candidate-setup-v2/candidate-practice-plan-baseline-repository";
import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";
import { createCandidateNextRoundRuntime } from "@/features/candidate-practice-v2/candidate-next-round-runtime";
import { CandidateAccountMenu } from "@/features/candidate-v2/CandidateAccountMenu";
import { CandidateDismissibleDetails } from "@/features/candidate-v2/CandidateDismissibleDetails";
import { getCandidateInitials } from "@/features/candidate-v2/candidate-identity";
import { CandidateThemeSwitcher } from "@/features/candidate-v2/CandidateThemeSwitcher";

type CandidateDashboardPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
    authorizedCandidateProfileId?: string;
    showAccountLogout?: boolean;
};

export default async function CandidateDashboardPage({
    searchParams,
    authorizedCandidateProfileId,
    showAccountLogout = false,
}: CandidateDashboardPageProps = {}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};

    return renderCandidateDashboardPage({
        dependencies: createDefaultCandidateDashboardPageDependencies(authorizedCandidateProfileId),
        selectedRoleProfileId: readSearchParam(resolvedSearchParams.prep),
        selectedLegacyTargetRole: readSearchParam(resolvedSearchParams.targetRole),
        canonicalizeSelection: true,
        showAccountLogout,
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
    showAccountLogout = false,
}: {
    dependencies?: CandidateDashboardPageDependencies;
    selectedRoleProfileId?: string | null;
    selectedLegacyTargetRole?: string | null;
    canonicalizeSelection?: boolean;
    showAccountLogout?: boolean;
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
    if (dashboard && !dashboard.activeRound && roleProfileId && dependencies.resolveNextRoundBuilder) {
        try {
            nextRoundBuilder = await dependencies.resolveNextRoundBuilder({
                candidateProfileId: dashboard.candidateProfileId,
                roleProfileId,
            });
        } catch {
            nextRoundBuilder = null;
        }
    }

    return <CandidateDashboardHome
        dashboard={dashboard}
        nextRoundBuilder={nextRoundBuilder}
        showAccountLogout={showAccountLogout}
    />;
}

function CandidateDashboardHome({
    dashboard,
    nextRoundBuilder,
    showAccountLogout,
}: {
    dashboard: CandidateDashboardV2ReadModel | null;
    nextRoundBuilder: CandidateNextRoundBuilderModel | null;
    showAccountLogout: boolean;
}) {
    const hasSelectedContext = Boolean(dashboard?.selectedTargetInterview);
    const page = (
        <main className="candidate-dashboard-page">
            <CandidateDashboardShellHeader
                dashboard={dashboard}
                showAccountLogout={showAccountLogout}
            />
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
    showAccountLogout,
}: {
    dashboard: CandidateDashboardV2ReadModel | null;
    showAccountLogout: boolean;
}) {
    const displayName = dashboard?.candidate.displayName;
    const email = dashboard?.candidate.email;
    const selectedTargetInterview = dashboard?.selectedTargetInterview ?? null;
    const alternateTargetInterviews = dashboard?.targetInterviews.filter((targetInterview) => !targetInterview.isSelected) ?? [];

    return (
        <header className="candidate-dashboard-topbar" aria-label="Dashboard header">
            <div className="candidate-dashboard-topbar__inner app-grid">
                <div className="candidate-dashboard-brand-row">
                    <InterviewCoachBrandMark
                        className="candidate-dashboard-brand-mark"
                        priority
                    />
                    <CandidateThemeSwitcher />
                </div>

                <div className="candidate-dashboard-control-row">
                    {showAccountLogout ? (
                        <CandidateAccountMenu
                            initials={getCandidateInitials(displayName, email)}
                            identityLabel={displayName || email || "candidate"}
                        />
                    ) : (
                        <div
                            className="candidate-dashboard-identity"
                            role="img"
                            aria-label={`Signed in as ${displayName || email || "candidate"}`}
                        >
                            {getCandidateInitials(displayName, email)}
                        </div>
                    )}

                    {selectedTargetInterview ? (
                        <CandidateDismissibleDetails className="candidate-dashboard-context-menu">
                            <summary>
                                <Briefcase size={16} aria-hidden="true" />
                                <span>
                                    <strong>{selectedTargetInterview.targetRole}</strong>
                                </span>
                                <ChevronDown size={18} aria-hidden="true" />
                            </summary>
                            <div className="candidate-dashboard-context-menu__popover">
                                <p className="type-eyebrow">Switch or add a role to practice</p>
                                <div className="candidate-dashboard-context-menu__current" aria-current="page">
                                    <strong>{selectedTargetInterview.targetRole}</strong>
                                </div>
                                {alternateTargetInterviews.map((targetInterview) => (
                                    <a
                                        key={targetInterview.id}
                                        href={createCandidateDashboardTargetInterviewHref(targetInterview)}
                                    >
                                        <strong>{targetInterview.targetRole}</strong>
                                    </a>
                                ))}
                                <a className="candidate-dashboard-context-menu__new" href="/candidate/setup">
                                    <Plus size={17} aria-hidden="true" />
                                    <span>Prep for a new role</span>
                                </a>
                            </div>
                        </CandidateDismissibleDetails>
                    ) : <span className="candidate-dashboard-topbar__spacer" />}

                    {!selectedTargetInterview ? (
                        <a
                            className="candidate-dashboard-next-link"
                            href="/candidate/setup"
                        >
                            <Plus size={18} aria-hidden="true" />
                            <span className="candidate-dashboard-next-link__label">
                                Set up practice
                            </span>
                        </a>
                    ) : null}
                </div>
            </div>
        </header>
    );
}

function CandidateDashboardLearningLoop({ dashboard }: { dashboard: CandidateDashboardV2ReadModel }) {
    return (
        <div className="candidate-dashboard-content">
            <CandidateDashboardCoachDeskExperience dashboard={dashboard} />
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

function CandidateDashboardEmptyState() {
    return (
        <Surface
            as="section"
            prominence="calm"
            className="candidate-dashboard-empty"
            aria-labelledby="candidate-dashboard-empty-title"
        >
            <h1 id="candidate-dashboard-empty-title">Build your first practice plan.</h1>
            <p>
                Tell us which role and interview you are preparing for to create your first round.
            </p>
            <Button
                href="/candidate/setup"
                emphasis="primary"
                density="default"
                shape="app"
                label="strong"
            >
                Set up practice
                <ArrowRight size={16} aria-hidden="true" />
            </Button>
        </Surface>
    );
}

function createDefaultCandidateDashboardPageDependencies(
    authorizedCandidateProfileId?: string,
): CandidateDashboardPageDependencies {
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
            const candidateProfileId = authorizedCandidateProfileId
                ?? await resolveCandidateProfileIdFromCurrentRequest(queryClient);

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
                    const accepted = parseCompatiblePersistedAcceptedEvidenceFirstEvaluatorRun(run.result);
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
                        acceptedRun: accepted,
                    }];
                }) ?? null,
                selectedRoleProfileId,
                selectedLegacyTargetRole,
            });
        },
        resolveNextRoundBuilder: nextRoundRuntime.loadBuilder,
    };
}

async function resolveCandidateProfileIdFromCurrentRequest(
    client: CandidateDashboardQueryClient,
) {
    const { headers } = await import("next/headers");
    const requestHeaders = await headers();
    return resolveCandidateProfileIdFromRequestHeaders(
        requestHeaders.get("cookie"),
        client,
    );
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
    const identity = await resolveCandidateOwnedCookieIdentity(cookieHeader, client);
    return identity?.candidateProfileId ?? null;
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
