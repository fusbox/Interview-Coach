import { ArrowRight, BadgeCheck, CircleDashed } from "lucide-react";

import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    createCandidateDashboardV2ReadModel,
    type CandidateDashboardV2ReadModel,
} from "@/features/candidate-dashboard-v2/candidate-dashboard-read-model";
import {
    createCandidatePracticeSessionRepository,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";

type CandidateDashboardPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CandidateDashboardPage({ searchParams }: CandidateDashboardPageProps = {}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};

    return renderCandidateDashboardPage({
        dependencies: createDefaultCandidateDashboardPageDependencies(),
        selectedTargetInterviewId: readSearchParam(resolvedSearchParams.targetRole),
    });
}

type CandidateDashboardPageDependencies = {
    resolveDashboardModel?: (input: {
        selectedTargetInterviewId?: string | null;
    }) => Promise<CandidateDashboardV2ReadModel | null>;
};

export async function renderCandidateDashboardPage({
    dependencies = {},
    selectedTargetInterviewId = null,
}: {
    dependencies?: CandidateDashboardPageDependencies;
    selectedTargetInterviewId?: string | null;
}) {
    const dashboard = dependencies.resolveDashboardModel
        ? await dependencies.resolveDashboardModel({ selectedTargetInterviewId })
        : null;

    return <CandidateDashboardHome dashboard={dashboard} />;
}

function CandidateDashboardHome({ dashboard }: { dashboard: CandidateDashboardV2ReadModel | null }) {
    return (
        <main className="candidate-design-system candidate-dashboard-page">
            <section className="candidate-dashboard-shell">
                <header className="candidate-dashboard-hero">
                    <div className="candidate-dashboard-hero__copy">
                        <h1>Coach Plan</h1>
                        <p>
                            Review what happened in practice, then choose the next useful move.
                        </p>
                    </div>
                    <DashboardEvidenceStrip dashboard={dashboard} />
                </header>
                {dashboard ? (
                    <CandidateDashboardLearningLoop dashboard={dashboard} />
                ) : (
                    <CandidateDashboardEmptyState />
                )}
            </section>
        </main>
    );
}

function DashboardEvidenceStrip({ dashboard }: { dashboard: CandidateDashboardV2ReadModel | null }) {
    const stats = dashboard?.stats ?? {
        activeRoundCount: 0,
        completedRoundCount: 0,
        answeredQuestionCount: 0,
        coachedAnswerCount: 0,
    };

    return (
        <div className="candidate-dashboard-evidence" aria-label="Practice evidence">
            <DashboardStat label="Completed rounds" value={stats.completedRoundCount} />
            <DashboardStat label="Answered questions" value={stats.answeredQuestionCount} />
            <DashboardStat label="Coached answers" value={stats.coachedAnswerCount} />
        </div>
    );
}

function CandidateDashboardLearningLoop({ dashboard }: { dashboard: CandidateDashboardV2ReadModel }) {
    const latestReview = dashboard.postRoundReviews[0] ?? null;
    const practicedQuestions = latestReview?.questions.filter((question) => question.status === "practiced") ?? [];
    const { planProgress, coachGuidedFocus, primaryAction } = dashboard.practiceDirection;

    return (
        <div className="candidate-dashboard-content">
            <CandidateDashboardTargetContext dashboard={dashboard} />
            <CandidateDashboardActiveRound activeRound={dashboard.activeRound} />

            <section className="candidate-learning-loop" aria-labelledby="learning-loop-title">
                <div className="candidate-learning-loop__header">
                    <div>
                        <p className="type-eyebrow">Reflect and choose</p>
                        <h2 id="learning-loop-title">Use practice as your next plan.</h2>
                    </div>
                    <p>{dashboard.coachingLoop.principle}</p>
                </div>

                <div className="candidate-learning-loop__panels">
                    <article className="candidate-loop-panel candidate-loop-panel--feedback">
                        <p className="candidate-loop-panel__meta">Feedback</p>
                        <h3>{dashboard.coachingLoop.feedback?.label ?? "Coach Update"}</h3>
                        {dashboard.coachingLoop.feedback ? (
                            <>
                                <p className="candidate-loop-panel__title">{dashboard.coachingLoop.feedback.title}</p>
                                <p>{dashboard.coachingLoop.feedback.body}</p>
                                {dashboard.coachingLoop.feedback.questionContext ? (
                                    <p className="candidate-loop-panel__context">{dashboard.coachingLoop.feedback.questionContext}</p>
                                ) : null}
                                {dashboard.coachingLoop.feedback.observation ? (
                                    <p className="candidate-loop-panel__quote">{dashboard.coachingLoop.feedback.observation}</p>
                                ) : null}
                                {latestReview ? (
                                    <a className="candidate-dashboard-action candidate-dashboard-action--secondary" href="#latest-round-review">
                                        Review coach feedback
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </a>
                                ) : null}
                            </>
                        ) : (
                            <p>Finish a practice round and I will reflect back what your answer shows.</p>
                        )}
                    </article>

                    <article className="candidate-loop-panel candidate-loop-panel--plan">
                        <p className="candidate-loop-panel__meta">Coach Plan</p>
                        <h3>{planProgress.label}</h3>
                        <p className="candidate-loop-panel__title">{planProgress.title}</p>
                        <p>{planProgress.body}</p>
                        {primaryAction !== "practice_from_feedback" ? (
                            <a className="candidate-dashboard-action" href={planProgress.href}>
                                {getPlanProgressActionLabel(planProgress.source)}
                                <ArrowRight size={16} aria-hidden="true" />
                            </a>
                        ) : null}
                    </article>

                    <article className="candidate-loop-panel candidate-loop-panel--coach-focus">
                        <p className="candidate-loop-panel__meta">Coach guidance</p>
                        <h3>{coachGuidedFocus?.label ?? "Practice from feedback"}</h3>
                        {coachGuidedFocus ? (
                            <>
                                <p className="candidate-loop-panel__title">{coachGuidedFocus.title}</p>
                                <p>{coachGuidedFocus.body}</p>
                            </>
                        ) : (
                            <>
                                <p className="candidate-loop-panel__title">Feedback-based practice comes after coaching.</p>
                                <p>Finish a practice round and I will separate what still belongs to the plan from what your answers suggest practicing next.</p>
                            </>
                        )}
                        {coachGuidedFocus && primaryAction === "practice_from_feedback" ? (
                            <a className="candidate-dashboard-action" href={coachGuidedFocus.href}>
                                Set up focused practice
                                <ArrowRight size={16} aria-hidden="true" />
                            </a>
                        ) : null}
                    </article>
                </div>
            </section>

            <section className="candidate-dashboard-review" id="latest-round-review" aria-labelledby="latest-review-title">
                <div className="candidate-dashboard-review__header">
                    <div>
                        <p className="type-eyebrow">Latest round</p>
                        <h2 id="latest-review-title">{latestReview?.targetRole ?? "Practice evidence"}</h2>
                    </div>
                    {latestReview ? (
                        <p>{latestReview.answeredCount} of {latestReview.questionCount} answered</p>
                    ) : null}
                </div>

                {latestReview && latestReview.questions.length > 0 ? (
                    <ol className="candidate-dashboard-question-list">
                        {latestReview.questions.map((question) => (
                            <CandidateDashboardReviewQuestion key={question.questionKey} question={question} />
                        ))}
                    </ol>
                ) : practicedQuestions.length > 0 ? (
                    <ol className="candidate-dashboard-question-list">
                        {practicedQuestions.slice(0, 3).map((question) => (
                            <li key={question.questionKey}>
                                <span className="candidate-dashboard-question-list__icon" aria-hidden="true">
                                    <BadgeCheck size={16} />
                                </span>
                                <div>
                                    <p className="candidate-dashboard-question-list__label">
                                        Q{question.questionNumber} · {question.category}
                                    </p>
                                    <h3>{question.questionText}</h3>
                                    {question.coaching ? <p>{question.coaching.nextPracticeFocus}</p> : null}
                                </div>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="candidate-dashboard-muted">Your practiced questions will appear here after your first completed round.</p>
                )}
            </section>
        </div>
    );
}

function CandidateDashboardReviewQuestion({
    question,
}: {
    question: CandidateDashboardV2ReadModel["postRoundReviews"][number]["questions"][number];
}) {
    const isPracticed = question.status === "practiced";

    return (
        <li className={isPracticed ? "is-practiced" : "is-missing-evidence"}>
            <span className="candidate-dashboard-question-list__icon" aria-hidden="true">
                {isPracticed ? <BadgeCheck size={16} /> : <CircleDashed size={16} />}
            </span>
            <div className="candidate-dashboard-question-list__content">
                <div className="candidate-dashboard-question-list__topline">
                    <p className="candidate-dashboard-question-list__label">
                        Q{question.questionNumber} - {question.category}
                    </p>
                    {!isPracticed ? (
                        <p className="candidate-dashboard-question-list__status">Needs practice evidence</p>
                    ) : null}
                </div>
                <h3>{question.questionText}</h3>
                {question.answer ? (
                    <blockquote className="candidate-dashboard-question-list__answer">
                        {question.answer.text}
                    </blockquote>
                ) : null}
                {question.coaching ? (
                    <div className="candidate-dashboard-question-list__coach">
                        <p>{question.coaching.observation}</p>
                        <p>{question.coaching.nextPracticeFocus}</p>
                    </div>
                ) : null}
                {!isPracticed ? (
                    <p className="candidate-dashboard-question-list__missing">
                        This planned question has not been answered yet. I will treat it as missing practice evidence, not as a weak answer.
                    </p>
                ) : null}
            </div>
        </li>
    );
}

function CandidateDashboardActiveRound({ activeRound }: { activeRound: CandidateDashboardV2ReadModel["activeRound"] }) {
    if (!activeRound) {
        return null;
    }

    return (
        <section className="candidate-dashboard-active-round" aria-label="Active round">
            <div>
                <p className="type-eyebrow">Active round</p>
                <h2>{activeRound.targetRole}</h2>
                <p>
                    {activeRound.progressLabel} · Question {activeRound.currentQuestionNumber} of {activeRound.questionCount}
                </p>
            </div>
            <a className="candidate-dashboard-action" href={activeRound.href}>
                Resume round
                <ArrowRight size={16} aria-hidden="true" />
            </a>
        </section>
    );
}

function CandidateDashboardTargetContext({ dashboard }: { dashboard: CandidateDashboardV2ReadModel }) {
    if (!dashboard.selectedTargetInterview) {
        return null;
    }

    const selectedTargetInterview = dashboard.selectedTargetInterview;
    const alternateTargetInterviews = dashboard.targetInterviews.filter((targetInterview) => !targetInterview.isSelected);

    return (
        <nav className="candidate-dashboard-context" aria-label="Interview prep context">
            <div className="candidate-dashboard-context__current">
                <p className="type-eyebrow">Current focus</p>
                <h2>{selectedTargetInterview.targetRole}</h2>
                <p>
                    {formatTargetInterviewProgress(selectedTargetInterview)}
                </p>
            </div>

            {alternateTargetInterviews.length > 0 ? (
                <div className="candidate-dashboard-context__switcher" aria-label="Switch role context">
                    {alternateTargetInterviews.map((targetInterview) => (
                        <a
                            key={targetInterview.id}
                            href={createDashboardTargetInterviewHref(targetInterview.id)}
                        >
                            <span>{targetInterview.targetRole}</span>
                            <span>{formatTargetInterviewProgress(targetInterview)}</span>
                        </a>
                    ))}
                </div>
            ) : null}
        </nav>
    );
}

function createDashboardTargetInterviewHref(targetInterviewId: string) {
    const searchParams = new URLSearchParams({ targetRole: targetInterviewId });
    return `/candidate/dashboard?${searchParams.toString()}`;
}

function formatTargetInterviewProgress(targetInterview: CandidateDashboardV2ReadModel["targetInterviews"][number]) {
    const roundLabel = targetInterview.activeRoundCount > 0
        ? `${targetInterview.activeRoundCount} active`
        : `${targetInterview.completedRoundCount} completed`;
    const answerLabel = `${targetInterview.answeredQuestionCount} answered`;
    return `${roundLabel} · ${answerLabel}`;
}

function getPlanProgressActionLabel(source: CandidateDashboardV2ReadModel["practiceDirection"]["planProgress"]["source"]) {
    switch (source) {
        case "active_round":
            return "Resume round";
        case "unanswered_planned_questions":
            return "Finish planned practice";
        case "first_round":
            return "Set up practice";
        case "completed_plan":
        default:
            return "Set up next practice";
    }
}

function CandidateDashboardEmptyState() {
    return (
        <section className="candidate-dashboard-empty" aria-label="No completed practice rounds">
            <p className="type-eyebrow">Practice evidence</p>
            <h2>Start with one practice round.</h2>
            <p>
                Once you finish, this page will connect what I noticed in your answers with what would be useful to practice next.
            </p>
            <a className="candidate-dashboard-action" href="/candidate/setup">
                Set up practice
                <ArrowRight size={16} aria-hidden="true" />
            </a>
        </section>
    );
}

function DashboardStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="candidate-dashboard-stat">
            <p className="type-eyebrow">{label}</p>
            <p className="type-metric-value">{value}</p>
        </div>
    );
}

function createDefaultCandidateDashboardPageDependencies(): CandidateDashboardPageDependencies {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);

    return {
        async resolveDashboardModel({ selectedTargetInterviewId }) {
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

                return createCandidateDashboardV2ReadModel({
                    candidateProfileId,
                    practiceSessions,
                    selectedTargetInterviewId,
                });
            } catch {
                return null;
            }
        },
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
