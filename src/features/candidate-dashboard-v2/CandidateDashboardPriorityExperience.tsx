"use client";

import useEmblaCarousel from "embla-carousel-react";
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Map,
    MessageSquareQuote,
    Play,
    RefreshCw,
    Route,
    X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { CandidateCoachPlanReferenceDialog } from "./CandidateCoachPlanReference";
import { CandidateTranscriptCanvas } from "./CandidateTranscriptCanvas";
import { useCandidateNextRoundBuilder } from "./CandidateNextRoundBuilderExperience";
import { CandidatePlanProgressAction } from "./CandidatePlanProgressAction";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";
import type {
    CandidateDashboardCoachUpdateState,
    CandidateDashboardV2ReadModel,
} from "./candidate-dashboard-read-model";

type CandidateDashboardPriority = "active-round" | "coach-update" | "practice-next" | "coach-plan";
type CoachUpdateSeenState = "unknown" | "new" | "seen";

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

            {isCoachUpdateOpen && dashboard.coachUpdateDetail ? (
                <CandidateCoachUpdateDialog
                    detail={dashboard.coachUpdateDetail}
                    onClose={() => setIsCoachUpdateOpen(false)}
                />
            ) : null}

            {isCoachPlanOpen && dashboard.coachPlan ? (
                <CandidateCoachPlanReferenceDialog
                    plan={dashboard.coachPlan}
                    onClose={() => setIsCoachPlanOpen(false)}
                />
            ) : null}
        </>
    );
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
                {dashboard.coachPlan ? (
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

function CandidateCoachUpdateDialog({
    detail,
    onClose,
}: {
    detail: NonNullable<CandidateDashboardV2ReadModel["coachUpdateDetail"]>;
    onClose: () => void;
}) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: "center",
        containScroll: false,
        loop: false,
        slidesToScroll: 1,
    });
    const dialogRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const resetContentScroll = useCallback(() => {
        if (!contentRef.current) return;
        if (typeof contentRef.current.scrollTo === "function") {
            contentRef.current.scrollTo({ top: 0 });
        } else {
            contentRef.current.scrollTop = 0;
        }
    }, []);

    const selectQuestion = useCallback((index: number, scrollCarousel = true) => {
        const nextIndex = Math.min(Math.max(index, 0), detail.items.length - 1);
        setSelectedIndex(nextIndex);
        if (scrollCarousel && emblaApi?.selectedSnap() !== nextIndex) {
            emblaApi?.goTo(nextIndex);
        }
        resetContentScroll();
    }, [detail.items.length, emblaApi, resetContentScroll]);

    useEffect(() => {
        if (!emblaApi) return undefined;
        const syncSelection = () => {
            setSelectedIndex(emblaApi.selectedSnap());
            resetContentScroll();
        };
        const syncSnaps = () => {
            setScrollSnaps(emblaApi.snapList());
            syncSelection();
        };
        emblaApi.on("select", syncSelection);
        emblaApi.on("reinit", syncSnaps);
        syncSnaps();
        return () => {
            emblaApi.off("select", syncSelection);
            emblaApi.off("reinit", syncSnaps);
        };
    }, [emblaApi, resetContentScroll]);

    useEffect(() => {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
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
            previousFocusRef.current?.focus();
        };
    }, [onClose]);

    const handleCarouselKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            selectQuestion(selectedIndex - 1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            selectQuestion(selectedIndex + 1);
        }
    };

    const navigationItems = scrollSnaps.length > 0 ? scrollSnaps : detail.items.map((_, index) => index);

    return (
        <div
            className="candidate-coach-update-backdrop"
            data-testid="coach-update-backdrop"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                className="candidate-coach-update-dialog"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-coach-update-title"
                onKeyDown={handleCarouselKeyDown}
            >
                <header className="candidate-coach-update-dialog__header">
                    <MessageSquareQuote size={20} aria-hidden="true" />
                    <h2 id="candidate-coach-update-title">Let&apos;s review your latest practice.</h2>
                    <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close Coach Update">
                        <X size={19} aria-hidden="true" />
                    </button>
                </header>

                <div className="candidate-coach-update-dialog__body" ref={contentRef}>
                    <p className="candidate-coach-update-dialog__context">{detail.summary}</p>
                    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                        Showing question feedback {selectedIndex + 1} of {detail.items.length}
                    </p>

                    {detail.items.length > 1 ? (
                        <nav className="candidate-coach-update-nav" aria-label="Coach Update question navigation">
                            <button
                                type="button"
                                aria-label="Previous question feedback"
                                disabled={selectedIndex === 0}
                                onClick={() => selectQuestion(selectedIndex - 1)}
                            >
                                <ChevronLeft size={17} aria-hidden="true" />
                            </button>
                            <div role="tablist" aria-label="Question feedback slides">
                                {navigationItems.map((_, index) => {
                                    const item = detail.items[index];
                                    if (!item) return null;
                                    const isCurrent = selectedIndex === index;
                                    return (
                                        <button
                                            key={item.questionKey}
                                            type="button"
                                            role="tab"
                                            aria-selected={isCurrent}
                                            aria-controls={`coach-update-slide-${item.questionKey}`}
                                            aria-label={isCurrent
                                                ? `Current feedback: question ${item.questionNumber}`
                                                : `Go to question ${item.questionNumber} feedback`}
                                            className={isCurrent ? "is-current" : undefined}
                                            onClick={() => selectQuestion(index)}
                                        >
                                            Q{item.questionNumber}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                aria-label="Next question feedback"
                                disabled={selectedIndex === detail.items.length - 1}
                                onClick={() => selectQuestion(selectedIndex + 1)}
                            >
                                <ChevronRight size={17} aria-hidden="true" />
                            </button>
                        </nav>
                    ) : null}

                    <div
                        className="candidate-coach-update-carousel"
                        ref={emblaRef}
                        role="region"
                        aria-label="Coach Update question feedback carousel"
                        aria-roledescription="carousel"
                    >
                        <div className="candidate-coach-update-carousel__track">
                            {detail.items.map((item, index) => {
                                const isCurrent = selectedIndex === index;
                                return (
                                    <div
                                        className={`candidate-coach-update-carousel__slide${isCurrent ? " is-current" : ""}`}
                                        id={`coach-update-slide-${item.questionKey}`}
                                        key={item.questionKey}
                                        role="group"
                                        aria-roledescription="slide"
                                        aria-label={`Question feedback ${index + 1} of ${detail.items.length}`}
                                        aria-hidden={isCurrent ? undefined : true}
                                    >
                                        <CandidateCoachUpdateQuestionCard item={item} isCurrent={isCurrent} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

function CandidateCoachUpdateQuestionCard({
    item,
    isCurrent,
}: {
    item: NonNullable<CandidateDashboardV2ReadModel["coachUpdateDetail"]>["items"][number];
    isCurrent: boolean;
}) {
    return (
        <article className="candidate-coach-update-question">
            <header className="candidate-coach-update-question__header">
                <span>Q{item.questionNumber}</span>
                <span>{item.category}</span>
            </header>
            <h3>{item.questionText}</h3>

            <div className="candidate-coach-update-question__review-grid">
                <section className="candidate-coach-update-question__answer" aria-labelledby={`candidate-answer-${item.questionKey}`}>
                    <p className="type-eyebrow" id={`candidate-answer-${item.questionKey}`}>Your response</p>
                    <CandidateTranscriptCanvas
                        answerText={item.answer.text}
                        projection={item.transcriptCanvas}
                        isCurrent={isCurrent}
                    />
                </section>

                <section className="candidate-coach-update-question__coach-read" aria-label="Coach observation">
                    <div className="candidate-coach-update-question__observation">
                        <p className="type-eyebrow">What I noticed</p>
                        <p>{item.coachRead.observation}</p>
                    </div>
                    <div className="candidate-coach-update-question__next-focus">
                        <p className="type-eyebrow">Try next</p>
                        <p>{item.coachRead.nextPracticeFocus}</p>
                    </div>
                    {item.comparison.kind === "repeat_practice" ? (
                        <p className="candidate-coach-update-question__comparison">{item.comparison.message}</p>
                    ) : null}
                </section>
            </div>

            <CandidateQuestionPracticeActions
                pointer={{
                    sourceCandidatePracticeSessionId: item.focusedPracticeAction.source.candidatePracticeSessionId,
                    sourceQuestionKey: item.focusedPracticeAction.source.questionKey,
                }}
                practiceNowHref={item.focusedPracticeAction.href}
                isCurrent={isCurrent}
            />
        </article>
    );
}

function getDashboardPriority(
    dashboard: CandidateDashboardV2ReadModel,
    seenState: CoachUpdateSeenState,
): CandidateDashboardPriority {
    if (dashboard.activeRound) return "active-round";
    if (dashboard.coachUpdateState.status === "candidate_coach_update_ready" && seenState !== "seen") {
        return "coach-update";
    }
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
