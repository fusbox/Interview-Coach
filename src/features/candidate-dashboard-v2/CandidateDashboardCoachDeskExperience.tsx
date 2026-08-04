"use client";

import {
    ArrowRight,
    Check,
    ChevronRight,
    Clock3,
    Loader2,
    RefreshCw,
    Sparkles,
    Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from "react";

import { Surface } from "@/components/ui/surface";
import { CandidateCoachAvatar } from "@/features/candidate-v2/CandidateCoachAvatar";

import { CandidateCoachPlanReferenceDialog } from "./CandidateCoachPlanReference";
import { CandidateCoachUpdateDialog } from "./CandidateCoachUpdateDialog";
import {
    createCandidateCoachUpdateSeenStorageKey,
    getDashboardPriority,
    type CandidateDashboardPriority,
    type CoachUpdateSeenState,
} from "./CandidateDashboardPriorityExperience";
import { useCandidateNextRoundBuilder } from "./CandidateNextRoundBuilderExperience";
import {
    CandidateFixedPracticeAction,
    CandidatePlanProgressAction,
} from "./CandidatePlanProgressAction";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";
import type {
    CandidateDashboardCoachUpdateState,
    CandidateDashboardV2ReadModel,
} from "./candidate-dashboard-read-model";

type DashboardView = "practice" | "progress";

type DashboardQuestionContext = {
    questionKey: string | null;
    questionNumber: number;
    totalCount: number;
    categoryLabel: string;
    questionText: string | null;
};

export function CandidateDashboardCoachDeskExperience({
    dashboard,
}: {
    dashboard: CandidateDashboardV2ReadModel;
}) {
    const readyState = dashboard.coachUpdateState.status === "candidate_coach_update_ready"
        ? dashboard.coachUpdateState
        : null;
    const storageKey = useMemo(() => createCandidateCoachUpdateSeenStorageKey(dashboard), [dashboard]);
    const [seenState, setSeenState] = useState<CoachUpdateSeenState>("unknown");
    const [view, setView] = useState<DashboardView>("practice");
    const [isCoachUpdateOpen, setIsCoachUpdateOpen] = useState(false);
    const [isCoachPlanOpen, setIsCoachPlanOpen] = useState(false);
    const [repairState, setRepairState] = useState<"idle" | "submitting" | "error">("idle");
    const router = useRouter();
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

    const repairCoachUpdate = useCallback(async () => {
        const state = dashboard.coachUpdateState;
        if (state.status !== "candidate_coach_update_unavailable" || repairState === "submitting") return;

        setRepairState("submitting");
        try {
            const response = await fetch(
                `/candidate/session/${encodeURIComponent(state.candidatePracticeSessionId)}/coach-update/repair`,
                { method: "POST" },
            );
            if (!response.ok) throw new Error("Coach Update repair failed.");
            setRepairState("idle");
            router.refresh();
        } catch {
            setRepairState("error");
        }
    }, [dashboard.coachUpdateState, repairState, router]);

    const priority = getDashboardPriority(dashboard, seenState);
    const openPlan = () => setIsCoachPlanOpen(true);

    return (
        <>
            <div className="candidate-dashboard-coach-desk">
                <CandidateDashboardViewTabs view={view} onChange={setView} />

                {view === "practice" ? (
                    <section
                        className="candidate-dashboard-view-panel"
                        id="candidate-dashboard-practice-panel"
                        role="tabpanel"
                        aria-labelledby="candidate-dashboard-practice-tab"
                    >
                        <CandidateDashboardStage
                            dashboard={dashboard}
                            priority={priority}
                            isCoachUpdateOpen={isCoachUpdateOpen}
                            onOpenCoachUpdate={openCoachUpdate}
                            onOpenPlan={openPlan}
                            onOpenBuilder={nextRoundBuilder?.openBuilder}
                        />
                        <CandidateDashboardQuietSecondary
                            dashboard={dashboard}
                            priority={priority}
                            repairState={repairState}
                            onOpenCoachUpdate={openCoachUpdate}
                            onRepairCoachUpdate={repairCoachUpdate}
                        />
                    </section>
                ) : (
                    <section
                        className="candidate-dashboard-view-panel"
                        id="candidate-dashboard-progress-panel"
                        role="tabpanel"
                        aria-labelledby="candidate-dashboard-progress-tab"
                    >
                        <CandidateDashboardPlanProgress dashboard={dashboard} onOpenPlan={openPlan} />
                        <CandidateDashboardQuietSecondary
                            dashboard={dashboard}
                            priority={priority}
                            repairState={repairState}
                            onOpenCoachUpdate={openCoachUpdate}
                            onRepairCoachUpdate={repairCoachUpdate}
                        />
                    </section>
                )}
            </div>

            {isCoachUpdateOpen && dashboard.coachUpdateDetail ? (
                <CandidateCoachUpdateDialog
                    detail={dashboard.coachUpdateDetail}
                    onClose={() => setIsCoachUpdateOpen(false)}
                />
            ) : null}

            {isCoachPlanOpen && dashboard.coachPlan ? (
                <CandidateCoachPlanReferenceDialog
                    answerReviews={dashboard.coachUpdateDetail?.items}
                    plan={dashboard.coachPlan}
                    preparedness={dashboard.questionPreparedness}
                    onClose={() => setIsCoachPlanOpen(false)}
                />
            ) : null}
        </>
    );
}

function CandidateDashboardViewTabs({
    view,
    onChange,
}: {
    view: DashboardView;
    onChange: (view: DashboardView) => void;
}) {
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const tabs: Array<{ id: DashboardView; label: string }> = [
        { id: "practice", label: "Practice" },
        { id: "progress", label: "Progress" },
    ];

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
        let nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;

        event.preventDefault();
        onChange(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
    };

    return (
        <div className="candidate-dashboard-view-tabs" role="tablist" aria-label="Dashboard view">
            {tabs.map((tab, index) => (
                <button
                    key={tab.id}
                    ref={(element) => { tabRefs.current[index] = element; }}
                    id={`candidate-dashboard-${tab.id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={view === tab.id}
                    aria-controls={`candidate-dashboard-${tab.id}-panel`}
                    tabIndex={view === tab.id ? 0 : -1}
                    onClick={() => onChange(tab.id)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function CandidateDashboardStage({
    dashboard,
    priority,
    isCoachUpdateOpen,
    onOpenCoachUpdate,
    onOpenPlan,
    onOpenBuilder,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    priority: CandidateDashboardPriority;
    isCoachUpdateOpen: boolean;
    onOpenCoachUpdate: () => void;
    onOpenPlan: () => void;
    onOpenBuilder?: () => void;
}) {
    if (priority === "active-round" && dashboard.activeRound) {
        return <CandidateDashboardActiveRoundStage dashboard={dashboard} />;
    }

    if (
        priority === "coach-update"
        && dashboard.coachUpdateState.status === "candidate_coach_update_ready"
        && dashboard.coachUpdateDetail
    ) {
        return (
            <CandidateDashboardReadyUpdateStage
                dashboard={dashboard}
                isOpen={isCoachUpdateOpen}
                onOpen={onOpenCoachUpdate}
            />
        );
    }

    if (priority === "practice-next" && dashboard.practiceDirection.coachGuidedFocus) {
        return <CandidateDashboardPracticeNextStage dashboard={dashboard} />;
    }

    return (
        <CandidateDashboardPlanStage
            dashboard={dashboard}
            onOpenPlan={onOpenPlan}
            onOpenBuilder={onOpenBuilder}
        />
    );
}

function CandidateDashboardActiveRoundStage({ dashboard }: { dashboard: CandidateDashboardV2ReadModel }) {
    const activeRound = dashboard.activeRound;
    if (!activeRound) return null;

    const question = resolveDashboardQuestion(dashboard, { questionNumber: activeRound.currentQuestionNumber });

    return (
        <Surface
            as="section"
            prominence="glass-raised"
            className="candidate-dashboard-stage candidate-dashboard-stage--unfinished"
            aria-labelledby="candidate-dashboard-active-round-title"
        >
            <CandidateDashboardStageMeta
                icon={<Clock3 size={16} strokeWidth={2.2} />}
                label="Round in progress"
                detail={activeRound.progressLabel}
            />
            <h2 id="candidate-dashboard-active-round-title">Pick up where you left off</h2>
            <p>
                Your answer to question {activeRound.currentQuestionNumber} is still waiting. Nothing you submitted has been lost.
            </p>
            <CandidateDashboardQuestionReference question={question} compact />
            <div
                className="candidate-dashboard-round-progress"
                role="img"
                aria-label={`${activeRound.answeredCount} of ${activeRound.questionCount} questions answered`}
            >
                {Array.from({ length: activeRound.questionCount }, (_, index) => (
                    <span
                        key={index}
                        className={index < activeRound.answeredCount
                            ? "is-complete"
                            : index + 1 === activeRound.currentQuestionNumber
                                ? "is-current"
                                : undefined}
                    />
                ))}
            </div>
            <a className="candidate-dashboard-stage__primary" href={activeRound.href}>
                Resume question {activeRound.currentQuestionNumber}
                <ArrowRight size={17} aria-hidden="true" />
            </a>
        </Surface>
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

function CandidateDashboardPracticeNextStage({ dashboard }: { dashboard: CandidateDashboardV2ReadModel }) {
    const focus = dashboard.practiceDirection.coachGuidedFocus;
    if (!focus) return null;

    const question = resolveDashboardQuestion(dashboard, { questionKey: focus.questionKeys[0] });

    return (
        <Surface
            as="section"
            prominence="glass-raised"
            className="candidate-dashboard-stage candidate-dashboard-stage--next"
            aria-labelledby="candidate-dashboard-practice-next-title"
        >
            <CandidateDashboardStageMeta
                icon={<Zap size={16} strokeWidth={2.35} />}
                label="Practice next"
                detail="From your latest feedback"
                iconTone="action"
            />
            <CandidateDashboardQuestionReference question={question} />
            <h2 id="candidate-dashboard-practice-next-title">{focus.title}</h2>
            <CandidateQuestionPracticeActions
                pointer={{
                    sourceCandidatePracticeSessionId: focus.candidatePracticeSessionId,
                    sourceQuestionKey: focus.sourceQuestionKey,
                }}
                practiceNowHref={focus.href}
            />
        </Surface>
    );
}

function CandidateDashboardPlanStage({
    dashboard,
    onOpenPlan,
    onOpenBuilder,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    onOpenPlan: () => void;
    onOpenBuilder?: () => void;
}) {
    const planProgress = dashboard.practiceDirection.planProgress;
    const isColdStart = planProgress.source === "first_round";
    const firstQuestionKey = planProgress.questionKeys[0] ?? dashboard.coachPlan?.questions[0]?.questionKey;
    const question = firstQuestionKey
        ? resolveDashboardQuestion(dashboard, { questionKey: firstQuestionKey })
        : null;
    const questionCount = dashboard.coachPlan?.questionCount ?? dashboard.questionPreparedness?.coverage.canonicalQuestionCount ?? 0;

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
            {planProgress.source === "completed_plan" && onOpenBuilder ? (
                <button className="candidate-dashboard-stage__primary" type="button" onClick={onOpenBuilder}>
                    Open practice builder
                    <ArrowRight size={17} aria-hidden="true" />
                </button>
            ) : (
                <CandidatePlanProgressAction
                    planProgress={planProgress}
                    label={getPlanProgressActionLabel(planProgress.source, question?.questionNumber)}
                    onCustomize={onOpenBuilder}
                />
            )}
            {dashboard.coachPlan ? (
                <button className="candidate-dashboard-stage__secondary" type="button" onClick={onOpenPlan}>
                    {isColdStart ? "Review the plan first" : "View Coach Plan"}
                </button>
            ) : null}
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
    onOpenCoachUpdate,
    onRepairCoachUpdate,
}: {
    dashboard: CandidateDashboardV2ReadModel;
    priority: CandidateDashboardPriority;
    repairState: "idle" | "submitting" | "error";
    onOpenCoachUpdate: () => void;
    onRepairCoachUpdate: () => void;
}) {
    const state = dashboard.coachUpdateState;

    if (priority === "active-round" || state.status === "candidate_coach_update_awaiting_practice") {
        return null;
    }

    if (priority === "coach-update") {
        return <CandidateDashboardQuietPracticeNext dashboard={dashboard} />;
    }

    if (state.status === "candidate_coach_update_ready" && dashboard.coachUpdateDetail) {
        return (
            <Surface
                as="button"
                prominence="glass-quiet"
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
            />
        );
    }

    return null;
}

function CandidateDashboardQuietPracticeNext({ dashboard }: { dashboard: CandidateDashboardV2ReadModel }) {
    const focus = dashboard.practiceDirection.coachGuidedFocus;
    if (!focus) return null;

    const question = resolveDashboardQuestion(dashboard, { questionKey: focus.questionKeys[0] });
    const label = question ? `Practice next: question ${question.questionNumber}, ${focus.title}` : `Practice next: ${focus.title}`;

    return (
        <Surface
            as="article"
            prominence="glass-quiet"
            className="candidate-dashboard-quiet-row candidate-dashboard-quiet-row--next"
            id="practice-next"
        >
            <span className="candidate-dashboard-quiet-row__icon" aria-hidden="true">
                <Zap size={17} strokeWidth={2.3} />
            </span>
            <span className="candidate-dashboard-quiet-row__eyebrow">
                Practice next{question ? ` · Question ${question.questionNumber}` : ""}
            </span>
            <strong>{focus.title}</strong>
            {question?.questionText ? <em>{question.questionText}</em> : null}
            <CandidateFixedPracticeAction
                source="coach_update_detail"
                items={[{
                    intent: "coach-update-feedback-focus",
                    fromSession: focus.candidatePracticeSessionId,
                    questionKey: focus.sourceQuestionKey,
                }]}
                label="Start"
                ariaLabel={label}
                className="candidate-dashboard-quiet-row__overlay-action"
            />
        </Surface>
    );
}

function CandidateDashboardCoachUpdateStatus({
    state,
    repairState,
    onRepair,
}: {
    state: Exclude<CandidateDashboardCoachUpdateState, { status: "candidate_coach_update_ready" | "candidate_coach_update_awaiting_practice" }>;
    repairState: "idle" | "submitting" | "error";
    onRepair: () => void;
}) {
    const isPending = state.status === "candidate_coach_update_pending";

    return (
        <Surface
            as="article"
            prominence="glass-quiet"
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
    const preparednessByQuestion = new Map(
        dashboard.questionPreparedness?.questions.map((question) => [question.questionKey, question]) ?? [],
    );
    const planQuestions = dashboard.coachPlan?.questions
        ?? dashboard.questionPreparedness?.questions.map((question) => ({
            questionKey: question.questionKey,
            questionNumber: question.questionNumber,
            category: question.category,
            categoryLabel: formatCategoryLabel(question.category),
            questionText: question.questionText,
            evidenceStatus: question.state === "not_practiced" ? "missing_evidence" as const : "practiced" as const,
        }))
        ?? [];
    const totalCount = dashboard.questionPreparedness?.coverage.canonicalQuestionCount
        ?? dashboard.coachPlan?.questionCount
        ?? planQuestions.length;
    const strongCount = dashboard.questionPreparedness?.achievement.strong ?? 0;
    const strongPercent = totalCount > 0 ? Math.round((strongCount / totalCount) * 100) : 0;
    const style = { "--dashboard-plan-progress": strongPercent } as CSSProperties;

    return (
        <Surface
            as="section"
            prominence="glass-raised"
            className="candidate-dashboard-plan-progress"
            aria-labelledby="candidate-dashboard-plan-progress-title"
            style={style}
        >
            <header>
                <h2 id="candidate-dashboard-plan-progress-title">Coach plan progress</h2>
                {dashboard.coachPlan ? (
                    <button type="button" onClick={onOpenPlan}>
                        View plan
                        <ArrowRight size={15} aria-hidden="true" />
                    </button>
                ) : null}
            </header>
            <div className="candidate-dashboard-plan-progress__grid">
                <section aria-labelledby="candidate-dashboard-overall-label">
                    <h3 id="candidate-dashboard-overall-label">Overall</h3>
                    <div
                        className="candidate-dashboard-plan-gauge"
                        role="img"
                        aria-label={`${strongCount} of ${totalCount} questions are Strong`}
                    >
                        <svg viewBox="0 0 120 120" aria-hidden="true">
                            <circle className="candidate-dashboard-plan-gauge__track" cx="60" cy="60" r="48" />
                            <circle
                                className="candidate-dashboard-plan-gauge__value"
                                cx="60"
                                cy="60"
                                r="48"
                                pathLength="100"
                                strokeDasharray={`${strongPercent} 100`}
                            />
                        </svg>
                        <span>
                            <strong>{strongCount}</strong>
                            <small>of {totalCount}</small>
                        </span>
                    </div>
                </section>
                <section aria-labelledby="candidate-dashboard-questions-label">
                    <h3 id="candidate-dashboard-questions-label">Questions</h3>
                    <ol>
                        {planQuestions.map((question) => {
                            const preparedness = preparednessByQuestion.get(question.questionKey);
                            const state = preparedness?.state ?? "not_practiced";
                            const band = preparedness?.band ?? null;
                            const isStrong = band === "strong";
                            return (
                                <li key={question.questionKey} data-state={state} data-band={band ?? undefined}>
                                    <span aria-hidden="true">
                                        {isStrong ? <Check size={13} strokeWidth={2.8} /> : question.questionNumber}
                                    </span>
                                    <span>
                                        <strong>Question {question.questionNumber}</strong>
                                        <small>{getPreparednessLabel(state, band)}</small>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </section>
            </div>
        </Surface>
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
    const questionNumber = planQuestion?.questionNumber ?? preparednessQuestion?.questionNumber ?? selector.questionNumber;
    if (!questionNumber) return null;

    return {
        questionKey: planQuestion?.questionKey ?? preparednessQuestion?.questionKey ?? selector.questionKey ?? null,
        questionNumber,
        totalCount: dashboard.coachPlan?.questionCount
            ?? dashboard.questionPreparedness?.coverage.canonicalQuestionCount
            ?? dashboard.activeRound?.questionCount
            ?? questionNumber,
        categoryLabel: planQuestion?.categoryLabel
            ?? (preparednessQuestion ? formatCategoryLabel(preparednessQuestion.category) : ""),
        questionText: planQuestion?.questionText ?? preparednessQuestion?.questionText ?? null,
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
