"use client";

import {
    ArrowRight,
    ArrowUpRight,
    ChevronRight,
    Clock3,
    Loader2,
    RefreshCw,
    Sparkles,
    X,
    Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type RefCallback,
    type ReactNode,
} from "react";

import { Surface } from "@/components/ui/surface";
import { CandidateCoachAvatar } from "@/features/candidate-v2/CandidateCoachAvatar";

import { CandidateCoachPlanReferenceDialog } from "./CandidateCoachPlanReference";
import {
    CandidatePlanDial,
    type CandidatePlanDialState,
} from "./CandidatePlanDial";
import { CandidateCoachUpdateDialog } from "./CandidateCoachUpdateDialog";
import {
    createCandidateCoachUpdateSeenStorageKey,
    getDashboardPriority,
    type CandidateDashboardPriority,
    type CoachUpdateSeenState,
} from "./CandidateDashboardPriorityExperience";
import {
    useCandidateNextRoundBuilder,
} from "./CandidateNextRoundBuilderExperience";
import {
    CandidatePlanProgressAction,
} from "./CandidatePlanProgressAction";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";
import type {
    CandidateDashboardCoachUpdateState,
    CandidateDashboardV2ReadModel,
} from "./candidate-dashboard-read-model";

type DashboardQuestionContext = {
    questionKey: string | null;
    questionNumber: number;
    totalCount: number;
    categoryLabel: string;
    questionText: string | null;
};

export const CANDIDATE_COACH_UPDATE_REFRESH_DELAYS_MS = [
    2_000,
    4_000,
    8_000,
    16_000,
    30_000,
    65_000,
] as const;

export const CANDIDATE_ACTIVE_PRACTICE_NOTICE_DISMISSED_VERSION = "v1";

export function createCandidateActivePracticeNoticeStorageKey(dashboard: CandidateDashboardV2ReadModel) {
    return dashboard.activeRound
        ? `candidate-v2:active-practice-notice-dismissed:${dashboard.candidateProfileId}:${dashboard.activeRound.candidatePracticeSessionId}`
        : null;
}

export function CandidateDashboardCoachDeskExperience({
    dashboard,
}: {
    dashboard: CandidateDashboardV2ReadModel;
}) {
    const readyState = dashboard.coachUpdateState.status === "candidate_coach_update_ready"
        ? dashboard.coachUpdateState
        : null;
    const storageKey = useMemo(() => createCandidateCoachUpdateSeenStorageKey(dashboard), [dashboard]);
    const activePracticeNoticeStorageKey = useMemo(
        () => createCandidateActivePracticeNoticeStorageKey(dashboard),
        [dashboard],
    );
    const [seenState, setSeenState] = useState<CoachUpdateSeenState>("unknown");
    const [activePracticeNoticeResolution, setActivePracticeNoticeResolution] = useState<{
        storageKey: string | null;
        dismissed: boolean;
    }>({ storageKey: null, dismissed: true });
    const [isCoachUpdateOpen, setIsCoachUpdateOpen] = useState(false);
    const [isCoachPlanOpen, setIsCoachPlanOpen] = useState(false);
    const [isPracticeNextOpen, setIsPracticeNextOpen] = useState(false);
    const [repairState, setRepairState] = useState<"idle" | "submitting" | "error">("idle");
    const [pendingRefreshState, setPendingRefreshState] = useState<{
        requestKey: string | null;
        attempt: number;
    }>({ requestKey: null, attempt: 0 });
    const router = useRouter();
    const nextRoundBuilder = useCandidateNextRoundBuilder();
    const [continueRoundActionElement, setContinueRoundActionElement] = useState<HTMLAnchorElement | null>(null);
    const captureContinueRoundAction = useCallback<RefCallback<HTMLAnchorElement | HTMLElement | HTMLButtonElement>>(
        (node) => setContinueRoundActionElement(node instanceof HTMLAnchorElement ? node : null),
        [],
    );
    const pendingCoachUpdateRequestKey = dashboard.coachUpdateState.status === "candidate_coach_update_pending"
        ? `${dashboard.coachUpdateState.candidatePracticeSessionId}:${dashboard.coachUpdateState.requestedAt}`
        : null;
    const pendingRefreshAttempt = pendingRefreshState.requestKey === pendingCoachUpdateRequestKey
        ? pendingRefreshState.attempt
        : 0;

    useEffect(() => {
        if (
            !pendingCoachUpdateRequestKey
            || pendingRefreshAttempt >= CANDIDATE_COACH_UPDATE_REFRESH_DELAYS_MS.length
        ) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setPendingRefreshState({
                requestKey: pendingCoachUpdateRequestKey,
                attempt: pendingRefreshAttempt + 1,
            });
            router.refresh();
        }, CANDIDATE_COACH_UPDATE_REFRESH_DELAYS_MS[pendingRefreshAttempt]);

        return () => window.clearTimeout(timeoutId);
    }, [pendingCoachUpdateRequestKey, pendingRefreshAttempt, router]);

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

    useEffect(() => {
        if (!activePracticeNoticeStorageKey) {
            setActivePracticeNoticeResolution({ storageKey: null, dismissed: true });
            return;
        }

        const syncNoticeState = () => {
            try {
                setActivePracticeNoticeResolution({
                    storageKey: activePracticeNoticeStorageKey,
                    dismissed: window.localStorage.getItem(activePracticeNoticeStorageKey)
                        === CANDIDATE_ACTIVE_PRACTICE_NOTICE_DISMISSED_VERSION,
                });
            } catch {
                setActivePracticeNoticeResolution({
                    storageKey: activePracticeNoticeStorageKey,
                    dismissed: false,
                });
            }
        };
        const handleStorage = (event: StorageEvent) => {
            if (
                event.key === activePracticeNoticeStorageKey
                && event.newValue === CANDIDATE_ACTIVE_PRACTICE_NOTICE_DISMISSED_VERSION
            ) {
                setActivePracticeNoticeResolution({
                    storageKey: activePracticeNoticeStorageKey,
                    dismissed: true,
                });
            }
        };

        syncNoticeState();
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [activePracticeNoticeStorageKey]);

    const markCoachUpdateSeen = useCallback(() => {
        if (!readyState || !storageKey) return;

        try {
            window.localStorage.setItem(storageKey, readyState.presentationKey);
        } catch {
            // Browser persistence is deliberately noncritical presentation state.
        }
        setSeenState("seen");
    }, [readyState, storageKey]);

    const openCoachUpdate = useCallback(() => {
        markCoachUpdateSeen();
        setIsCoachUpdateOpen(true);
    }, [markCoachUpdateSeen]);
    const closeCoachUpdate = useCallback(() => setIsCoachUpdateOpen(false), []);
    const openPlan = useCallback(() => setIsCoachPlanOpen(true), []);
    const closePlan = useCallback(() => setIsCoachPlanOpen(false), []);
    const dismissActivePracticeNotice = useCallback(() => {
        if (activePracticeNoticeStorageKey) {
            try {
                window.localStorage.setItem(
                    activePracticeNoticeStorageKey,
                    CANDIDATE_ACTIVE_PRACTICE_NOTICE_DISMISSED_VERSION,
                );
            } catch {
                // Browser persistence is deliberately noncritical presentation state.
            }
        }
        setActivePracticeNoticeResolution({
            storageKey: activePracticeNoticeStorageKey,
            dismissed: true,
        });
        window.setTimeout(() => continueRoundActionElement?.focus(), 0);
    }, [activePracticeNoticeStorageKey, continueRoundActionElement]);

    const repairCoachUpdate = useCallback(async () => {
        const state = dashboard.coachUpdateState;
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
    }, [dashboard.coachUpdateState, repairState, router]);

    const checkPendingCoachUpdate = useCallback(() => {
        if (!pendingCoachUpdateRequestKey) return;
        setPendingRefreshState({ requestKey: pendingCoachUpdateRequestKey, attempt: 0 });
        router.refresh();
    }, [pendingCoachUpdateRequestKey, router]);

    const priority = getDashboardPriority(dashboard, seenState);

    return (
        <>
            <div className="candidate-dashboard-coach-desk" data-dashboard-state={priority}>
                {dashboard.activeRound
                    && activePracticeNoticeResolution.storageKey === activePracticeNoticeStorageKey
                    && !activePracticeNoticeResolution.dismissed ? (
                    <CandidateDashboardActivePracticeNotice
                        dashboard={dashboard}
                        onDismiss={dismissActivePracticeNotice}
                    />
                ) : null}
                <CandidateDashboardComposition
                    dashboard={dashboard}
                    priority={priority}
                    isCoachUpdateOpen={isCoachUpdateOpen}
                    repairState={repairState}
                    pendingRefreshExhausted={Boolean(
                        pendingCoachUpdateRequestKey
                        && pendingRefreshAttempt >= CANDIDATE_COACH_UPDATE_REFRESH_DELAYS_MS.length
                    )}
                    onOpenCoachUpdate={openCoachUpdate}
                    onOpenPlan={openPlan}
                    onOpenPracticeNext={() => setIsPracticeNextOpen(true)}
                    onOpenBuilder={nextRoundBuilder
                        ? () => nextRoundBuilder.openBuilder()
                        : undefined}
                    onRepairCoachUpdate={repairCoachUpdate}
                    onCheckPendingCoachUpdate={checkPendingCoachUpdate}
                    continueRoundActionRef={captureContinueRoundAction}
                />
            </div>

            {isCoachUpdateOpen && dashboard.coachUpdateDetail ? (
                <CandidateCoachUpdateDialog
                    detail={dashboard.coachUpdateDetail}
                    suppressPracticeActions={Boolean(dashboard.activeRound)}
                    onClose={closeCoachUpdate}
                />
            ) : null}

            {isCoachPlanOpen && dashboard.coachPlan ? (
                <CandidateCoachPlanReferenceDialog
                    answerReviews={dashboard.answerReviews}
                    plan={dashboard.coachPlan}
                    preparedness={dashboard.questionPreparedness}
                    initialPlanIncomplete={Boolean(dashboard.activeRound)}
                    initialPlanAnsweredQuestionKeys={dashboard.activeRound?.answeredQuestionKeys}
                    onClose={closePlan}
                />
            ) : null}

            {isPracticeNextOpen && dashboard.practiceDirection.coachGuidedFocus ? (
                <CandidateDashboardPracticeNextDialog
                    dashboard={dashboard}
                    onClose={() => setIsPracticeNextOpen(false)}
                />
            ) : null}
        </>
    );
}
function CandidateDashboardComposition({
    dashboard,
    priority,
    isCoachUpdateOpen,
    onOpenCoachUpdate,
    onOpenPlan,
    onOpenPracticeNext,
    onOpenBuilder,
    repairState,
    pendingRefreshExhausted,
    onRepairCoachUpdate,
    onCheckPendingCoachUpdate,
    continueRoundActionRef,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    priority: CandidateDashboardPriority;
    isCoachUpdateOpen: boolean;
    onOpenCoachUpdate: () => void;
    onOpenPlan: () => void;
    onOpenPracticeNext: () => void;
    onOpenBuilder?: () => void;
    repairState: "idle" | "submitting" | "error";
    pendingRefreshExhausted: boolean;
    onRepairCoachUpdate: () => void;
    onCheckPendingCoachUpdate: () => void;
    continueRoundActionRef: RefCallback<HTMLAnchorElement | HTMLElement | HTMLButtonElement>;
}) {
    const nextRoundBuilder = useCandidateNextRoundBuilder();
    const hasQueuedNextRound = Boolean(nextRoundBuilder?.builder.itemCount);
    const hasPlan = Boolean(dashboard.coachPlan || dashboard.questionPreparedness);

    if (priority === "active-round" && dashboard.activeRound) {
        return (
            <div className={`candidate-dashboard-bento-grid is-active-round${hasPlan ? "" : " is-planless"}`}>
                <CandidateDashboardUnfinishedActionStack
                    dashboard={dashboard}
                    continueRoundActionRef={continueRoundActionRef}
                />
                <CandidateDashboardPlanProgress dashboard={dashboard} onOpenPlan={onOpenPlan} />
                <CandidateDashboardQuietSecondary
                    dashboard={dashboard}
                    priority={priority}
                    repairState={repairState}
                    pendingRefreshExhausted={pendingRefreshExhausted}
                    onOpenCoachUpdate={onOpenCoachUpdate}
                    onRepairCoachUpdate={onRepairCoachUpdate}
                    onCheckPendingCoachUpdate={onCheckPendingCoachUpdate}
                />
            </div>
        );
    }

    if (
        priority === "coach-update"
        && dashboard.coachUpdateState.status === "candidate_coach_update_ready"
        && dashboard.coachUpdateDetail
    ) {
        return <div className={`candidate-dashboard-bento-grid is-ready-update${dashboard.activeRound ? " has-active-round" : ""}${hasPlan ? " has-plan" : ""}${hasPlan || hasQueuedNextRound || dashboard.activeRound ? "" : " is-stage-only"}`}>
            <CandidateDashboardReadyUpdateStage
                dashboard={dashboard}
                isOpen={isCoachUpdateOpen}
                onOpen={onOpenCoachUpdate}
            />
            {dashboard.activeRound ? (
                <>
                    <CandidateDashboardPlanProgress dashboard={dashboard} onOpenPlan={onOpenPlan} />
                    <CandidateDashboardUnfinishedActionStack
                        dashboard={dashboard}
                        continueRoundActionRef={continueRoundActionRef}
                    />
                </>
            ) : (
                <CandidateDashboardSupportShelf
                    dashboard={dashboard}
                    hasQueuedNextRound={hasQueuedNextRound}
                    onOpenPlan={onOpenPlan}
                />
            )}
        </div>;
    }

    if (priority === "practice-next" && dashboard.practiceDirection.coachGuidedFocus) {
        return (
            <div className={`candidate-dashboard-bento-grid is-practice-next${hasPlan ? "" : " is-planless"}`}>
                <div className={`candidate-dashboard-commitment-stack${hasQueuedNextRound ? "" : " is-single"}`}>
                    <CandidateDashboardPracticeNextWidget dashboard={dashboard} onOpen={onOpenPracticeNext} />
                    <CandidateDashboardNextRoundWidget />
                </div>
                <CandidateDashboardPlanProgress dashboard={dashboard} onOpenPlan={onOpenPlan} />
                <CandidateDashboardQuietSecondary
                    dashboard={dashboard}
                    priority={priority}
                    repairState={repairState}
                    pendingRefreshExhausted={pendingRefreshExhausted}
                    onOpenCoachUpdate={onOpenCoachUpdate}
                    onRepairCoachUpdate={onRepairCoachUpdate}
                    onCheckPendingCoachUpdate={onCheckPendingCoachUpdate}
                />
            </div>
        );
    }

    return (
        <div className={`candidate-dashboard-bento-grid is-plan-focus${hasQueuedNextRound ? " has-next-round" : ""}`}>
            <CandidateDashboardPlanStage
                dashboard={dashboard}
                onOpenPlan={onOpenPlan}
                onOpenBuilder={onOpenBuilder}
                hasQueuedNextRound={hasQueuedNextRound}
            />
            {hasQueuedNextRound ? (
                <div className="candidate-dashboard-compact-row">
                    <CandidateDashboardNextRoundWidget compact />
                </div>
            ) : null}
            <CandidateDashboardQuietSecondary
                dashboard={dashboard}
                priority={priority}
                repairState={repairState}
                pendingRefreshExhausted={pendingRefreshExhausted}
                onOpenCoachUpdate={onOpenCoachUpdate}
                onRepairCoachUpdate={onRepairCoachUpdate}
                onCheckPendingCoachUpdate={onCheckPendingCoachUpdate}
            />
        </div>
    );
}

function CandidateDashboardActivePracticeNotice({
    dashboard,
    onDismiss,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    onDismiss: () => void;
}) {
    const activeRound = dashboard.activeRound;
    if (!activeRound) return null;

    return (
        <Surface
            as="section"
            prominence="calm"
            className="candidate-dashboard-active-practice-notice"
            aria-labelledby="candidate-dashboard-active-practice-notice-title"
        >
            <div
                className="candidate-dashboard-active-practice-notice__message"
                role="status"
                aria-atomic="true"
            >
                <span className="candidate-dashboard-active-practice-notice__icon" aria-hidden="true">
                    <Clock3 size={17} strokeWidth={2.2} />
                </span>
                <div className="candidate-dashboard-active-practice-notice__copy">
                    <strong id="candidate-dashboard-active-practice-notice-title">Practice in progress</strong>
                    <span>{activeRound.progressLabel}</span>
                </div>
            </div>
            <div
                className="candidate-dashboard-round-progress candidate-dashboard-active-practice-notice__progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={activeRound.questionCount}
                aria-valuenow={activeRound.answeredCount}
                aria-valuetext={`${activeRound.answeredCount} of ${activeRound.questionCount} questions answered`}
            >
                {Array.from({ length: activeRound.questionCount }, (_, index) => (
                    <span
                        aria-hidden="true"
                        key={index}
                        className={activeRound.answeredQuestionNumbers?.includes(index + 1)
                            ? "is-complete"
                            : index + 1 === activeRound.currentQuestionNumber
                                ? "is-current"
                                : undefined}
                    />
                ))}
            </div>
            <a className="candidate-dashboard-active-practice-notice__resume" href={activeRound.href}>
                Resume practice
                <ArrowRight size={17} aria-hidden="true" />
            </a>
            <button
                className="candidate-dashboard-active-practice-notice__dismiss"
                type="button"
                aria-label="Dismiss practice-in-progress notification"
                onClick={onDismiss}
            >
                <X size={18} aria-hidden="true" />
            </button>
        </Surface>
    );
}

function CandidateDashboardUnfinishedActionStack({
    dashboard,
    continueRoundActionRef,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    continueRoundActionRef: RefCallback<HTMLAnchorElement | HTMLElement | HTMLButtonElement>;
}) {
    const activeRound = dashboard.activeRound;
    if (!activeRound) return null;
    return (
        <div className="candidate-dashboard-commitment-stack candidate-dashboard-unfinished-actions">
            <Surface
                ref={continueRoundActionRef}
                as="a"
                href={activeRound.href}
                prominence="calm"
                className="candidate-dashboard-action-tile candidate-dashboard-action-tile--next-round"
                aria-label={`Continue practice at question ${activeRound.currentQuestionNumber}`}
            >
                <span className="candidate-dashboard-action-tile__topline">
                    <strong>Continue round</strong>
                    <span className="candidate-dashboard-action-tile__direction" aria-hidden="true">
                        <ArrowUpRight size={20} strokeWidth={2.4} />
                    </span>
                </span>
                <span className="candidate-dashboard-action-tile__guidance">Keep moving through your plan.</span>
                <span className="candidate-dashboard-action-tile__mark candidate-dashboard-action-tile__mark--count" aria-hidden="true">
                    {activeRound.remainingQuestionCount ?? Math.max(activeRound.questionCount - activeRound.answeredCount, 0)}
                </span>
                <span className="candidate-dashboard-action-tile__descriptor">questions remaining</span>
            </Surface>
            <Surface
                as="a"
                href={activeRound.oneQuestionHref ?? `${activeRound.href}?pace=one`}
                prominence="feature-tint"
                className="candidate-dashboard-action-tile candidate-dashboard-action-tile--practice"
                aria-label={`Practice only question ${activeRound.currentQuestionNumber} now`}
            >
                <span className="candidate-dashboard-action-tile__topline">
                    <strong>One-question round</strong>
                    <span className="candidate-dashboard-action-tile__direction" aria-hidden="true">
                        <ArrowUpRight size={20} strokeWidth={2.4} />
                    </span>
                </span>
                <span className="candidate-dashboard-action-tile__guidance">Take one small step.</span>
                <span className="candidate-dashboard-action-tile__mark" aria-hidden="true">
                    <Zap size={27} strokeWidth={2.35} />
                </span>
                <span className="candidate-dashboard-action-tile__descriptor">Question {activeRound.currentQuestionNumber}</span>
            </Surface>
        </div>
    );
}

function CandidateDashboardReadyUpdateStage({
    dashboard,
    isOpen,
    onOpen,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    isOpen: boolean;
    onOpen: () => void;
}) {
    const range = formatCoachUpdateQuestionRange(dashboard);

    return (
        <Surface
            as="section"
            prominence="spotlight"
            className="candidate-dashboard-stage candidate-dashboard-stage--update"
            aria-labelledby="candidate-dashboard-ready-update-title"
        >
            <button
                className="candidate-dashboard-update-presence"
                type="button"
                data-coach-update-trigger
                aria-label="Open Coach Update"
                onClick={onOpen}
            >
                <span>
                    <CandidateCoachAvatar
                        variant={isOpen ? "calm" : "cta"}
                        className="candidate-dashboard-coach-avatar"
                    />
                    Coach update ready
                </span>
                <ChevronRight size={17} aria-hidden="true" />
            </button>
            <h2 id="candidate-dashboard-ready-update-title">Feedback is ready for {range}</h2>
            <p>I reviewed {range}. Open the update to move through each question and its accepted evidence.</p>
            <button
                className="candidate-dashboard-stage__primary on-color-action"
                type="button"
                data-coach-update-trigger
                onClick={onOpen}
            >
                Review {range}
                <ArrowRight size={17} aria-hidden="true" />
            </button>
        </Surface>
    );
}

function CandidateDashboardPracticeNextWidget({
    dashboard,
    onOpen,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    onOpen: () => void;
}) {
    const focus = dashboard.practiceDirection.coachGuidedFocus;
    if (!focus) return null;

    const question = resolveDashboardQuestion(dashboard, { questionKey: focus.questionKeys[0] });
    const label = question
        ? `Open one-question practice for question ${question.questionNumber}`
        : "Open one-question practice";

    return (
        <Surface
            as="button"
            prominence="feature-tint"
            className="candidate-dashboard-action-tile candidate-dashboard-action-tile--practice"
            aria-label={label}
            aria-haspopup="dialog"
            onClick={onOpen}
        >
            <span className="candidate-dashboard-action-tile__topline">
                <strong>One-question round</strong>
                <span className="candidate-dashboard-action-tile__direction" aria-hidden="true">
                    <ArrowUpRight size={20} strokeWidth={2.4} />
                </span>
            </span>
            <span className="candidate-dashboard-action-tile__guidance">Sharpen one answer.</span>
            <span className="candidate-dashboard-action-tile__mark" aria-hidden="true">
                <Zap size={27} strokeWidth={2.35} />
            </span>
            <span className="candidate-dashboard-action-tile__descriptor">
                Practice next{question ? ` · Q${question.questionNumber}` : ""}
            </span>
        </Surface>
    );
}

function CandidateDashboardNextRoundWidget({ compact = false }: { compact?: boolean }) {
    const controller = useCandidateNextRoundBuilder();
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    if (!controller || controller.builder.itemCount < 1) return null;

    const count = controller.builder.itemCount;
    return (
        <Surface
            ref={triggerRef}
            as="button"
            prominence="calm"
            className={`candidate-dashboard-action-tile candidate-dashboard-action-tile--next-round${compact ? " is-compact" : ""}`}
            aria-label={`Review next round, ${count} ${count === 1 ? "question" : "questions"}`}
            aria-haspopup="dialog"
            onClick={() => controller.openBuilder(triggerRef.current)}
        >
            <span className="candidate-dashboard-action-tile__topline">
                <strong>Next round</strong>
                <span className="candidate-dashboard-action-tile__direction" aria-hidden="true">
                    <ArrowUpRight size={20} strokeWidth={2.4} />
                </span>
            </span>
            <span className="candidate-dashboard-action-tile__guidance">Build a focused round.</span>
            <span className="candidate-dashboard-action-tile__mark candidate-dashboard-action-tile__mark--count" aria-hidden="true">
                {count}
            </span>
            <span className="candidate-dashboard-action-tile__descriptor">
                {count === 1 ? "1 question ready" : `${count} questions ready`}
            </span>
        </Surface>
    );
}

function CandidateDashboardSupportShelf({
    dashboard,
    hasQueuedNextRound,
    onOpenPlan,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    hasQueuedNextRound: boolean;
    onOpenPlan: () => void;
}) {
    const hasPlan = Boolean(dashboard.coachPlan || dashboard.questionPreparedness);
    if (!hasPlan && !hasQueuedNextRound) return null;

    return (
        <div className={`candidate-dashboard-support-shelf${hasPlan && !hasQueuedNextRound ? " is-plan-only" : ""}`}>
            {hasPlan ? <CandidateDashboardPlanProgress dashboard={dashboard} onOpenPlan={onOpenPlan} /> : null}
            {hasQueuedNextRound ? <CandidateDashboardNextRoundWidget /> : null}
        </div>
    );
}

function CandidateDashboardPlanStage({
    dashboard,
    onOpenPlan,
    onOpenBuilder,
    hasQueuedNextRound,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    onOpenPlan: () => void;
    onOpenBuilder?: () => void;
    hasQueuedNextRound: boolean;
}) {
    const planProgress = dashboard.practiceDirection.planProgress;
    const isColdStart = planProgress.source === "first_round" && !dashboard.questionPreparedness;
    const firstQuestionKey = planProgress.questionKeys[0] ?? dashboard.coachPlan?.questions[0]?.questionKey;
    const question = firstQuestionKey
        ? resolveDashboardQuestion(dashboard, { questionKey: firstQuestionKey })
        : null;
    const questionCount = dashboard.coachPlan?.questionCount ?? dashboard.questionPreparedness?.coverage.canonicalQuestionCount ?? 0;
    const primaryAction = planProgress.source === "completed_plan" ? (
        !hasQueuedNextRound && onOpenBuilder ? (
            <button className="candidate-dashboard-stage__primary" type="button" onClick={onOpenBuilder}>
                Open practice builder
                <ArrowRight size={17} aria-hidden="true" />
            </button>
        ) : null
    ) : (
        <CandidatePlanProgressAction
            planProgress={planProgress}
            label={getPlanProgressActionLabel(planProgress.source, question?.questionNumber)}
            onCustomize={onOpenBuilder}
        />
    );
    const planMove = (
        <div className="candidate-dashboard-plan-focus__move">
            <h2 id="candidate-dashboard-plan-stage-title">
                {isColdStart
                    ? "Start with the questions most likely to shape this interview"
                    : planProgress.title}
            </h2>
            <p>
                {isColdStart
                    ? "Practice one answer now. Your plan will fill in with evidence as you work."
                    : planProgress.body}
            </p>
            {question ? <CandidateDashboardQuestionReference question={question} /> : null}
            {primaryAction}
            {dashboard.coachPlan ? (
                <button className="candidate-dashboard-stage__secondary" type="button" onClick={onOpenPlan}>
                    {isColdStart ? "Review the plan first" : "View Coach Plan"}
                </button>
            ) : null}
        </div>
    );

    return (
        <Surface
            as="section"
            prominence="glass-raised"
            className={`candidate-dashboard-stage candidate-dashboard-stage--plan${isColdStart ? " candidate-dashboard-stage--cold" : ""}`}
            aria-labelledby="candidate-dashboard-plan-stage-title"
        >
            <CandidateDashboardStageMeta
                icon={<Sparkles size={16} strokeWidth={2.2} />}
                label={isColdStart ? "Your plan is ready" : "Coach plan"}
                detail={questionCount > 0 ? `${questionCount} questions` : undefined}
            />
            {isColdStart ? <CandidateDashboardPlanIgnition dashboard={dashboard} /> : null}
            {!isColdStart && dashboard.questionPreparedness ? (
                <div className="candidate-dashboard-plan-focus__workspace">
                    <CandidateDashboardPlanDial dashboard={dashboard} />
                    {planMove}
                </div>
            ) : planMove}
        </Surface>
    );
}

function CandidateDashboardStageMeta({
    icon,
    label,
    detail,
    iconTone = "glass",
}: {
    icon: ReactNode;
    label: string;
    detail?: string;
    iconTone?: "glass" | "action";
}) {
    return (
        <div className="candidate-dashboard-stage__meta">
            <span>
                <span className="candidate-dashboard-stage__meta-icon" data-tone={iconTone} aria-hidden="true">
                    {icon}
                </span>
                {label}
            </span>
            {detail ? <span>{detail}</span> : null}
        </div>
    );
}

function CandidateDashboardQuestionReference({
    question,
    compact = false,
}: {
    question: DashboardQuestionContext | null;
    compact?: boolean;
}) {
    if (!question) return null;

    return (
        <div className={`candidate-dashboard-question-reference${compact ? " is-compact" : ""}`}>
            <span>
                Question {question.questionNumber} of {question.totalCount}
                {question.categoryLabel ? ` · ${question.categoryLabel}` : ""}
            </span>
            {question.questionText ? <p>{question.questionText}</p> : null}
        </div>
    );
}

function CandidateDashboardQuietSecondary({
    dashboard,
    priority,
    repairState,
    pendingRefreshExhausted,
    onOpenCoachUpdate,
    onRepairCoachUpdate,
    onCheckPendingCoachUpdate,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    priority: CandidateDashboardPriority;
    repairState: "idle" | "submitting" | "error";
    pendingRefreshExhausted: boolean;
    onOpenCoachUpdate: () => void;
    onRepairCoachUpdate: () => void;
    onCheckPendingCoachUpdate: () => void;
}) {
    const state = dashboard.coachUpdateState;

    if (state.status === "candidate_coach_update_awaiting_practice") {
        return null;
    }

    if (priority === "coach-update") return null;

    if (state.status === "candidate_coach_update_ready" && dashboard.coachUpdateDetail) {
        return (
            <Surface
                as="button"
                prominence="coach-quiet"
                className="candidate-dashboard-quiet-row candidate-dashboard-quiet-row--update"
                type="button"
                data-coach-update-trigger
                aria-haspopup="dialog"
                aria-label="Open Coach Update"
                onClick={onOpenCoachUpdate}
            >
                <CandidateCoachAvatar variant="surface" className="candidate-dashboard-coach-avatar" />
                <span>
                    <span className="candidate-dashboard-quiet-row__eyebrow">
                        Coach update · {formatCoachUpdateQuestionRange(dashboard)}
                    </span>
                    <strong>Review feedback by question</strong>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
            </Surface>
        );
    }

    if (state.status === "candidate_coach_update_pending" || state.status === "candidate_coach_update_unavailable") {
        return (
            <CandidateDashboardCoachUpdateStatus
                state={state}
                repairState={repairState}
                onRepair={onRepairCoachUpdate}
                showPendingRefreshAction={pendingRefreshExhausted}
                onRefreshPending={onCheckPendingCoachUpdate}
            />
        );
    }

    return null;
}

function CandidateDashboardCoachUpdateStatus({
    state,
    repairState,
    onRepair,
    showPendingRefreshAction,
    onRefreshPending,
}: {
    state: Exclude<CandidateDashboardCoachUpdateState, { status: "candidate_coach_update_ready" | "candidate_coach_update_awaiting_practice" }>;
    repairState: "idle" | "submitting" | "error";
    onRepair: () => void;
    showPendingRefreshAction: boolean;
    onRefreshPending: () => void;
}) {
    const isPending = state.status === "candidate_coach_update_pending";

    return (
        <Surface
            as="article"
            prominence="glass-quiet"
            state={isPending ? "loading" : "default"}
            className="candidate-dashboard-status-row"
            aria-live={isPending ? "polite" : undefined}
        >
            <span className="candidate-dashboard-status-row__icon" aria-hidden="true">
                {isPending
                    ? <Loader2 className="is-spinning" size={17} />
                    : <RefreshCw size={17} />}
            </span>
            <div>
                <p className="candidate-dashboard-quiet-row__eyebrow">Coach update</p>
                <strong>{isPending ? "I’m preparing your review" : "Your practice is saved"}</strong>
                <p>
                    {isPending
                        ? "Your review will appear when the coaching pass finishes."
                        : "I couldn’t prepare the update, but your answers and in-session coaching remain saved."}
                </p>
                {!isPending ? (
                    <button type="button" disabled={repairState === "submitting"} onClick={onRepair}>
                        {repairState === "submitting" ? "Preparing Coach Update" : "Try Coach Update again"}
                    </button>
                ) : null}
                {isPending && showPendingRefreshAction ? (
                    <button type="button" onClick={onRefreshPending}>Check for update</button>
                ) : null}
                {repairState === "error" ? (
                    <p role="alert">I still couldn’t prepare the update. Your practice remains saved.</p>
                ) : null}
            </div>
        </Surface>
    );
}

function CandidateDashboardPlanProgress({
    dashboard,
    onOpenPlan,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    onOpenPlan: () => void;
}) {
    if (!dashboard.coachPlan && !dashboard.questionPreparedness) return null;

    return (
        <Surface
            as="section"
            prominence="plan"
            className="candidate-dashboard-plan-progress"
            aria-labelledby="candidate-dashboard-plan-progress-title"
        >
            <header>
                <h2 id="candidate-dashboard-plan-progress-title">Coach plan</h2>
                {dashboard.coachPlan ? (
                    <button type="button" aria-label="View Coach Plan" onClick={onOpenPlan}>
                        <ArrowRight size={20} aria-hidden="true" />
                    </button>
                ) : null}
            </header>
            {dashboard.questionPreparedness ? (
                <CandidateDashboardPlanDial dashboard={dashboard} />
            ) : (
                <CandidateDashboardPlanIgnition dashboard={dashboard} />
            )}
        </Surface>
    );
}

function CandidateDashboardPlanDial({
    dashboard,
    decorative = false,
    showLegend = true,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    decorative?: boolean;
    showLegend?: boolean;
}) {
    const questions = getDashboardPlanDialQuestions(dashboard);
    const totalCount = dashboard.questionPreparedness?.coverage.canonicalQuestionCount ?? questions.length;
    const strongCount = dashboard.questionPreparedness?.achievement.strong ?? 0;
    const summary = `${strongCount} of ${totalCount} questions are Strong. ${questions
        .map((question) => `Question ${question.questionNumber}: ${getPreparednessLabel(question.state, question.band)}`)
        .join(". ")}`;

    if (questions.length === 0 || !dashboard.questionPreparedness) return null;

    return (
        <CandidatePlanDial
            aria-label={summary}
            decorative={decorative}
            questions={questions.map((question) => ({
                questionKey: question.questionKey,
                questionNumber: question.questionNumber,
                state: getPlanDialState(question.state, question.band),
                stateLabel: getPreparednessLabel(question.state, question.band),
            }))}
            showLegend={showLegend}
        />
    );
}

function CandidateDashboardPlanIgnition({ dashboard }: { dashboard: CandidateDashboardV2ReadModel }) {
    const questions = getDashboardPlanDialQuestions(dashboard);
    if (questions.length === 0) return null;
    const recommendedKey = dashboard.practiceDirection.planProgress.questionKeys[0] ?? questions[0].questionKey;

    return (
        <ol
            className="candidate-dashboard-plan-ignition"
            aria-label={`${questions.length}-question Coach Plan. Question ${questions.find((question) => question.questionKey === recommendedKey)?.questionNumber ?? questions[0].questionNumber} is recommended first.`}
        >
            {questions.map((question) => (
                <li key={question.questionKey} data-recommended={question.questionKey === recommendedKey || undefined}>
                    <span>Q{question.questionNumber}</span>
                </li>
            ))}
        </ol>
    );
}

function getDashboardPlanDialQuestions(dashboard: CandidateDashboardV2ReadModel) {
    const preparednessByQuestion = new Map(
        dashboard.questionPreparedness?.questions.map((question) => [question.questionKey, question]) ?? [],
    );
    const sourceQuestions = dashboard.coachPlan?.questions ?? dashboard.questionPreparedness?.questions ?? [];

    return sourceQuestions.map((question) => {
        const preparedness = preparednessByQuestion.get(question.questionKey);
        return {
            questionKey: question.questionKey,
            questionNumber: question.questionNumber,
            state: preparedness?.state ?? "not_practiced" as const,
            band: preparedness?.band ?? null,
        };
    });
}

function getPlanDialState(
    state: ReturnType<typeof getDashboardPlanDialQuestions>[number]["state"],
    band: ReturnType<typeof getDashboardPlanDialQuestions>[number]["band"],
): CandidatePlanDialState {
    if (band) return band;
    if (state === "not_practiced") return "not-practiced";
    if (state === "incomplete") return "incomplete";
    if (state === "evaluation_unavailable") return "unavailable";
    return "unrated";
}

function CandidateDashboardPracticeNextDialog({
    dashboard,
    onClose,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    onClose: () => void;
}) {
    const focus = dashboard.practiceDirection.coachGuidedFocus;
    const question = focus
        ? resolveDashboardQuestion(dashboard, { questionKey: focus.questionKeys[0] })
        : null;
    const dialogRef = useRef<HTMLElement | null>(null);
    const closeRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useLayoutEffect(() => {
        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            window.requestAnimationFrame(() => previousFocusRef.current?.focus());
        };
    }, [onClose]);

    if (!focus) return null;

    return (
        <div
            className="candidate-coach-update-backdrop candidate-dashboard-practice-next-backdrop"
            role="presentation"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                ref={dialogRef}
                className="candidate-coach-update-dialog candidate-dashboard-practice-next-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-dashboard-practice-next-dialog-title"
            >
                <span className="candidate-dashboard-practice-next-dialog__grabber" aria-hidden="true" />
                <header className="candidate-dashboard-practice-next-dialog__header">
                    <div>
                        <span>Practice next</span>
                        <h2 id="candidate-dashboard-practice-next-dialog-title">One-question round</h2>
                    </div>
                    <button ref={closeRef} type="button" aria-label="Close one-question round" onClick={onClose}>
                        <X size={20} aria-hidden="true" />
                    </button>
                </header>
                <div className="candidate-dashboard-practice-next-dialog__body">
                    <CandidateDashboardQuestionReference question={question} />
                    <section className="candidate-dashboard-practice-next-dialog__guidance" aria-labelledby="candidate-dashboard-practice-next-guidance-title">
                        <span>Try next</span>
                        <h3 id="candidate-dashboard-practice-next-guidance-title">{focus.title}</h3>
                    </section>
                    <CandidateQuestionPracticeActions
                        pointer={{
                            sourceCandidatePracticeSessionId: focus.candidatePracticeSessionId,
                            sourceQuestionKey: focus.sourceQuestionKey,
                        }}
                        practiceNowHref={focus.href}
                    />
                </div>
            </section>
        </div>
    );
}

function resolveDashboardQuestion(
    dashboard: CandidateDashboardV2ReadModel,
    selector: { questionKey?: string; questionNumber?: number },
): DashboardQuestionContext | null {
    const planQuestion = dashboard.coachPlan?.questions.find((question) => (
        selector.questionKey
            ? question.questionKey === selector.questionKey
            : question.questionNumber === selector.questionNumber
    ));
    const preparednessQuestion = dashboard.questionPreparedness?.questions.find((question) => (
        selector.questionKey
            ? question.questionKey === selector.questionKey
            : question.questionNumber === selector.questionNumber
    ));
    const reviewQuestion = dashboard.coachUpdateDetail?.items.find((question) => (
        selector.questionKey
            ? question.questionKey === selector.questionKey
            : question.questionNumber === selector.questionNumber
    ));
    const questionNumber = planQuestion?.questionNumber
        ?? preparednessQuestion?.questionNumber
        ?? reviewQuestion?.questionNumber
        ?? selector.questionNumber;
    if (!questionNumber) return null;

    return {
        questionKey: planQuestion?.questionKey
            ?? preparednessQuestion?.questionKey
            ?? reviewQuestion?.questionKey
            ?? selector.questionKey
            ?? null,
        questionNumber,
        totalCount: dashboard.coachPlan?.questionCount
            ?? dashboard.questionPreparedness?.coverage.canonicalQuestionCount
            ?? dashboard.coachUpdateDetail?.questionCount
            ?? dashboard.activeRound?.questionCount
            ?? questionNumber,
        categoryLabel: planQuestion?.categoryLabel
            ?? (preparednessQuestion ? formatCategoryLabel(preparednessQuestion.category) : null)
            ?? reviewQuestion?.category
            ?? "",
        questionText: planQuestion?.questionText
            ?? preparednessQuestion?.questionText
            ?? reviewQuestion?.questionText
            ?? null,
    };
}

function formatCategoryLabel(value: string) {
    return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatCoachUpdateQuestionRange(dashboard: CandidateDashboardV2ReadModel) {
    const questionNumbers = dashboard.coachUpdateDetail?.items
        .map((item) => item.questionNumber)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((left, right) => left - right) ?? [];

    if (questionNumbers.length === 0) return "your latest questions";
    if (questionNumbers.length === 1) return `question ${questionNumbers[0]}`;
    const isConsecutive = questionNumbers.every((number, index) => index === 0 || number === questionNumbers[index - 1] + 1);
    if (isConsecutive) return `questions ${questionNumbers[0]}–${questionNumbers[questionNumbers.length - 1]}`;
    return `questions ${questionNumbers.join(", ")}`;
}

function getPreparednessLabel(
    state: NonNullable<CandidateDashboardV2ReadModel["questionPreparedness"]>["questions"][number]["state"],
    band: NonNullable<CandidateDashboardV2ReadModel["questionPreparedness"]>["questions"][number]["band"],
) {
    if (state === "rated" && band) return band.charAt(0).toUpperCase() + band.slice(1);
    if (state === "incomplete") return "Needs a complete answer";
    if (state === "evaluation_unavailable") return "Coaching unavailable";
    return "Not practiced yet";
}

function getPlanProgressActionLabel(
    source: CandidateDashboardV2ReadModel["practiceDirection"]["planProgress"]["source"],
    questionNumber?: number,
) {
    switch (source) {
        case "active_round":
            return "Resume round";
        case "unanswered_planned_questions":
            return "Finish planned practice";
        case "first_round":
            return questionNumber ? `Start question ${questionNumber}` : "Set up practice";
        case "completed_plan":
        default:
            return "Open practice builder";
    }
}
