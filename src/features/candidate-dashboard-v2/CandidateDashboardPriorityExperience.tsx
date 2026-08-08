"use client";

import {
    ArrowRight,
    Loader2,
    Map,
    MessageSquareQuote,
    Play,
    RefreshCw,
    Route,
    Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
} from "react";

import { CandidateCoachUpdateDialog } from "./CandidateCoachUpdateDialog";
import { CandidateCoachPlanReferenceDialog } from "./CandidateCoachPlanReference";
import { useCandidateNextRoundBuilder } from "./CandidateNextRoundBuilderExperience";
import { CandidatePlanProgressAction } from "./CandidatePlanProgressAction";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";
import type {
    CandidateDashboardCoachUpdateState,
    CandidateDashboardV2ReadModel,
} from "./candidate-dashboard-read-model";

export type CandidateDashboardPriority = "active-round" | "coach-update" | "practice-next" | "coach-plan";
export type CoachUpdateSeenState = "unknown" | "new" | "seen";

export function CandidateDashboardPriorityExperience({
    dashboard,
}: {
    dashboard: CandidateDashboardV2ReadModel;
}) {
    const readyState = dashboard.coachUpdateState.status === "candidate_coach_update_ready"
        ? dashboard.coachUpdateState
        : null;
    const storageKey = useMemo(() => createCandidateCoachUpdateSeenStorageKey(dashboard), [dashboard]);
    const [seenState, setSeenState] = useState<CoachUpdateSeenState>("unknown");
    const [isCoachUpdateOpen, setIsCoachUpdateOpen] = useState(false);
    const [isCoachPlanOpen, setIsCoachPlanOpen] = useState(false);
    const nextRoundBuilder = useCandidateNextRoundBuilder();

    useEffect(() => {
        if (!readyState || !storageKey) {
            setSeenState("seen");
            return;
        }

        try {
            setSeenState(window.localStorage.getItem(storageKey) === readyState.presentationKey ? "seen" : "new");
        } catch {
            setSeenState("new");
        }
    }, [readyState, storageKey]);

    const markCoachUpdateSeen = useCallback(() => {
        if (!readyState || !storageKey) {
            return;
        }

        try {
            window.localStorage.setItem(storageKey, readyState.presentationKey);
        } catch {
            // Browser persistence is deliberately noncritical presentation state.
        }
        setSeenState("seen");
    }, [readyState, storageKey]);

    const priority = getDashboardPriority(dashboard, seenState);

    return (
        <>
            <section
                className={`candidate-dashboard-priority-grid candidate-dashboard-priority-grid--${priority}`}
                aria-label="Practice priorities"
            >
                <CandidateDashboardActiveRound
                    activeRound={dashboard.activeRound}
                    isPrimary={priority === "active-round"}
                />
                <CandidateDashboardCoachUpdatePanel
                    dashboard={dashboard}
                    isPrimary={priority === "coach-update"}
                    isNew={seenState === "new"}
                    onOpen={() => {
                        markCoachUpdateSeen();
                        setIsCoachUpdateOpen(true);
                    }}
                />
                <CandidateDashboardPracticeNextPanel
                    dashboard={dashboard}
                    isPrimary={priority === "practice-next"}
                />
                <CandidateDashboardCoachPlanPanel
                    dashboard={dashboard}
                    isPrimary={priority === "coach-plan"}
                    onOpen={() => setIsCoachPlanOpen(true)}
                    onOpenBuilder={nextRoundBuilder?.openBuilder}
                />
            </section>

            <CandidateDashboardPreparedness
                preparedness={dashboard.questionPreparedness}
                onOpenPlan={() => setIsCoachPlanOpen(true)}
            />

            {isCoachUpdateOpen && dashboard.coachUpdateDetail ? (
                <CandidateCoachUpdateDialog
                    detail={dashboard.coachUpdateDetail}
                    suppressPracticeActions={Boolean(dashboard.activeRound)}
                    onClose={() => setIsCoachUpdateOpen(false)}
                />
            ) : null}

            {isCoachPlanOpen && dashboard.coachPlan ? (
                <CandidateCoachPlanReferenceDialog
                    answerReviews={dashboard.answerReviews}
                    plan={dashboard.coachPlan}
                    initialPlanIncomplete={Boolean(dashboard.activeRound)}
                    initialPlanAnsweredQuestionKeys={dashboard.activeRound?.answeredQuestionKeys}
                    onClose={() => setIsCoachPlanOpen(false)}
                />
            ) : null}
        </>
    );
}

function CandidateDashboardPreparedness({
    preparedness,
    onOpenPlan,
}: {
    preparedness: CandidateDashboardV2ReadModel["questionPreparedness"];
    onOpenPlan: () => void;
}) {
    if (!preparedness) return null;

    const { coverage, achievement, questions } = preparedness;
    const practicedCount = coverage.attemptedQuestionCount;
    const totalCount = coverage.canonicalQuestionCount;
    const coveragePercent = totalCount > 0
        ? Math.round((practicedCount / totalCount) * 100)
        : 0;

    return (
        <section className="candidate-preparedness" aria-labelledby="candidate-preparedness-title">
            <header className="candidate-preparedness__header">
                <div>
                    <p className="type-eyebrow">Progress toward preparedness</p>
                    <h2 id="candidate-preparedness-title">See where your practice is taking you.</h2>
                    <p>
                        Coverage shows what you have practiced. Each question keeps the strongest level you have reached.
                    </p>
                </div>
                <button className="candidate-dashboard-reference-action" type="button" onClick={onOpenPlan}>
                    View Coach Plan
                    <ArrowRight size={16} aria-hidden="true" />
                </button>
            </header>

            <div className="candidate-preparedness__body">
                <div
                    className="candidate-preparedness__coverage"
                    role="img"
                    aria-label={`${practicedCount} of ${totalCount} planned questions practiced`}
                    style={{ "--candidate-coverage": `${coveragePercent}%` } as CSSProperties}
                >
                    <span aria-hidden="true">
                        <strong>{practicedCount}</strong>
                        <small>of {totalCount}</small>
                    </span>
                    <p>questions practiced</p>
                </div>

                <div className="candidate-preparedness__achievement">
                    <p className="type-eyebrow">Highest level reached</p>
                    <dl>
                        <div data-band="strong">
                            <dt>Strong</dt>
                            <dd>{achievement.strong}</dd>
                        </div>
                        <div data-band="clear">
                            <dt>Clear</dt>
                            <dd>{achievement.clear}</dd>
                        </div>
                        <div data-band="emerging">
                            <dt>Emerging</dt>
                            <dd>{achievement.emerging}</dd>
                        </div>
                    </dl>
                </div>

                <ol className="candidate-preparedness__questions" aria-label="Question preparedness">
                    {questions.map((question) => (
                        <li key={question.questionKey} data-state={question.state} data-band={question.band ?? undefined}>
                            <span aria-hidden="true">
                                {question.state === "rated" ? (
                                    <Target size={16} />
                                ) : question.questionNumber}
                            </span>
                            <div>
                                <p>Question {question.questionNumber}</p>
                                <strong>{getPreparednessLabel(question.state, question.band)}</strong>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

function getPreparednessLabel(
    state: NonNullable<CandidateDashboardV2ReadModel["questionPreparedness"]>["questions"][number]["state"],
    band: NonNullable<CandidateDashboardV2ReadModel["questionPreparedness"]>["questions"][number]["band"],
) {
    if (state === "rated" && band) {
        return band.charAt(0).toUpperCase() + band.slice(1);
    }
    if (state === "incomplete") return "Needs a complete answer";
    if (state === "evaluation_unavailable") return "Coaching unavailable";
    return "Not practiced yet";
}

export function createCandidateCoachUpdateSeenStorageKey(dashboard: CandidateDashboardV2ReadModel) {
    const selectedContextId = dashboard.selectedTargetInterview?.roleProfileId
        ?? (dashboard.coachUpdateState.status === "candidate_coach_update_ready"
            ? dashboard.coachUpdateState.candidatePracticeSessionId
            : null);
    return selectedContextId
        ? `candidate-v2:coach-update-seen:${dashboard.candidateProfileId}:${selectedContextId}`
        : null;
}

function CandidateDashboardCoachUpdatePanel({
    dashboard,
    isPrimary,
    isNew,
    onOpen,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    isPrimary: boolean;
    isNew: boolean;
    onOpen: () => void;
}) {
    const router = useRouter();
    const [repairState, setRepairState] = useState<"idle" | "submitting" | "error">("idle");
    const state = dashboard.coachUpdateState;
    const className = `candidate-dashboard-module candidate-dashboard-module--coach-update${isPrimary ? " is-primary" : ""}`;
    const heading = (
        <div className="candidate-dashboard-module__heading">
            <span className="candidate-dashboard-module__icon" aria-hidden="true">
                <MessageSquareQuote size={19} />
            </span>
            <p className="type-eyebrow">Coach Update</p>
            {isNew ? <span className="candidate-dashboard-coach-update-new">New</span> : null}
        </div>
    );

    if (state.status === "candidate_coach_update_ready" && dashboard.coachUpdateDetail) {
        const answerLabel = state.answeredCount === 1 ? "answer" : "answers";
        return (
            <button
                className={`${className} candidate-dashboard-module--link candidate-dashboard-module--button`}
                type="button"
                aria-haspopup="dialog"
                aria-label="Open Coach Update"
                onClick={onOpen}
            >
                {heading}
                <h2>Your latest practice review is ready.</h2>
                <p>
                    I reviewed {state.answeredCount} {answerLabel} from your latest {dashboard.coachUpdateDetail.targetRole} round.
                </p>
                <span className="candidate-dashboard-module__meta">Open your question-by-question review</span>
                <ArrowRight className="candidate-dashboard-module__arrow" size={20} aria-hidden="true" />
            </button>
        );
    }

    const repairCoachUpdate = async () => {
        if (state.status !== "candidate_coach_update_unavailable" || repairState === "submitting") return;
        setRepairState("submitting");
        try {
            const repairParams = state.sourceQuestionKey
                ? `?question=${encodeURIComponent(state.sourceQuestionKey)}`
                : "";
            const response = await fetch(
                `/candidate/session/${encodeURIComponent(state.candidatePracticeSessionId)}/coach-update/repair${repairParams}`,
                { method: "POST" },
            );
            if (!response.ok) throw new Error("Coach Update repair failed.");
            setRepairState("idle");
            router.refresh();
        } catch {
            setRepairState("error");
        }
    };

    return (
        <article className={className} aria-live={state.status === "candidate_coach_update_pending" ? "polite" : undefined}>
            {heading}
            <CoachUpdateStatusCopy
                state={state}
                repairState={repairState}
                onRepair={repairCoachUpdate}
            />
        </article>
    );
}

function CoachUpdateStatusCopy({
    state,
    repairState,
    onRepair,
}: {
    state: CandidateDashboardCoachUpdateState;
    repairState: "idle" | "submitting" | "error";
    onRepair: () => void;
}) {
    switch (state.status) {
        case "candidate_coach_update_pending":
            return (
                <>
                    <h2>I&apos;m preparing your Coach Update.</h2>
                    <p>Your practice is saved. This review will be ready when the coaching pass finishes.</p>
                    <Loader2 className="candidate-dashboard-coach-update-spinner" size={20} aria-hidden="true" />
                </>
            );
        case "candidate_coach_update_unavailable":
            return (
                <>
                    <h2>Your practice is saved.</h2>
                    <p>I couldn&apos;t prepare this Coach Update. Your answers and in-session coaching remain saved, and you can keep moving with Practice Next.</p>
                    <div className="candidate-dashboard-module__actions">
                        <button
                            className="candidate-dashboard-action candidate-dashboard-action--secondary"
                            type="button"
                            disabled={repairState === "submitting"}
                            onClick={onRepair}
                        >
                            {repairState === "submitting"
                                ? <Loader2 className="candidate-dashboard-coach-update-spinner" size={16} aria-hidden="true" />
                                : <RefreshCw size={16} aria-hidden="true" />}
                            {repairState === "submitting" ? "Preparing Coach Update" : "Try Coach Update again"}
                        </button>
                    </div>
                    {repairState === "error" ? (
                        <p role="alert">I still couldn&apos;t prepare the update. Your practice remains saved.</p>
                    ) : null}
                </>
            );
        case "candidate_coach_update_awaiting_practice":
        default:
            return (
                <>
                    <h2>Your next update starts with practice.</h2>
                    <p>After a completed round, I&apos;ll connect what your answers showed with what would be useful to work on next.</p>
                </>
            );
    }
}

function CandidateDashboardPracticeNextPanel({
    dashboard,
    isPrimary,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    isPrimary: boolean;
}) {
    const coachGuidedFocus = dashboard.practiceDirection.coachGuidedFocus;
    const feedforward = dashboard.coachingLoop.feedforward;

    return (
        <article
            className={`candidate-dashboard-module candidate-dashboard-module--practice-next${isPrimary ? " is-primary" : ""}`}
            id="practice-next"
        >
            <div className="candidate-dashboard-module__heading">
                <span className="candidate-dashboard-module__icon" aria-hidden="true">
                    <Route size={19} />
                </span>
                <p className="type-eyebrow">Practice Next</p>
            </div>
            <h2>{coachGuidedFocus?.title ?? feedforward.title}</h2>
            <p>{coachGuidedFocus?.body ?? feedforward.body}</p>
            {coachGuidedFocus && isPrimary ? (
                <CandidateQuestionPracticeActions
                    pointer={{
                        sourceCandidatePracticeSessionId: coachGuidedFocus.candidatePracticeSessionId,
                        sourceQuestionKey: coachGuidedFocus.questionKeys[0],
                    }}
                    practiceNowHref={coachGuidedFocus.href}
                />
            ) : null}
        </article>
    );
}

function CandidateDashboardCoachPlanPanel({
    dashboard,
    isPrimary,
    onOpen,
    onOpenBuilder,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    isPrimary: boolean;
    onOpen: () => void;
    onOpenBuilder?: () => void;
}) {
    const planProgress = dashboard.practiceDirection.planProgress;

    return (
        <article className={`candidate-dashboard-module candidate-dashboard-module--coach-plan${isPrimary ? " is-primary" : ""}`}>
            <div className="candidate-dashboard-module__heading">
                <span className="candidate-dashboard-module__icon" aria-hidden="true">
                    <Map size={19} />
                </span>
                <p className="type-eyebrow">Coach Plan</p>
            </div>
            <h2>{planProgress.title}</h2>
            <p>{planProgress.body}</p>
            <div className="candidate-dashboard-module__actions">
                {isPrimary && planProgress.href ? (
                    <CandidatePlanProgressAction
                        planProgress={planProgress}
                        label={getPlanProgressActionLabel(planProgress.source)}
                        onCustomize={onOpenBuilder}
                    />
                ) : isPrimary && planProgress.source === "completed_plan" && onOpenBuilder ? (
                    <button className="candidate-dashboard-action" type="button" onClick={onOpenBuilder}>
                        Open practice builder
                        <ArrowRight size={16} aria-hidden="true" />
                    </button>
                ) : null}
                {dashboard.coachPlan && !dashboard.questionPreparedness ? (
                    <button className="candidate-dashboard-reference-action" type="button" onClick={onOpen}>
                        View Coach Plan
                        <ArrowRight size={16} aria-hidden="true" />
                    </button>
                ) : null}
            </div>
        </article>
    );
}

function CandidateDashboardActiveRound({
    activeRound,
    isPrimary,
}: {
    activeRound: CandidateDashboardV2ReadModel["activeRound"];
    isPrimary: boolean;
}) {
    if (!activeRound) {
        return null;
    }

    return (
        <section className={`candidate-dashboard-active-round${isPrimary ? " is-primary" : ""}`} aria-label="Active round">
            <div>
                <div className="candidate-dashboard-module__heading">
                    <span className="candidate-dashboard-module__icon" aria-hidden="true">
                        <Play size={19} />
                    </span>
                    <p className="type-eyebrow">Active round</p>
                </div>
                <h2>Continue where you left off.</h2>
                <div className="candidate-dashboard-active-round__meta">
                    <strong>{activeRound.targetRole}</strong>
                    <span>{activeRound.progressLabel} &middot; Question {activeRound.currentQuestionNumber} of {activeRound.questionCount}</span>
                </div>
            </div>
            <a className="candidate-dashboard-action" href={activeRound.href}>
                Resume round
                <ArrowRight size={16} aria-hidden="true" />
            </a>
        </section>
    );
}

export function getDashboardPriority(
    dashboard: CandidateDashboardV2ReadModel,
    seenState: CoachUpdateSeenState,
): CandidateDashboardPriority {
    if (dashboard.coachUpdateState.status === "candidate_coach_update_ready" && seenState !== "seen") {
        return "coach-update";
    }
    if (dashboard.activeRound) return "active-round";
    return dashboard.practiceDirection.primaryAction === "practice_from_feedback"
        ? "practice-next"
        : "coach-plan";
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
            return "Open practice builder";
    }
}
