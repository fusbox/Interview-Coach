"use client";

import {
    ArrowRight,
    Check,
    Eye,
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
    WorkflowTimeline,
    WorkflowTimelineStep,
} from "@/components/ui/WorkflowTimeline";
import { CandidateOpenedSurfaceHeader } from "@/features/candidate-v2/CandidateOpenedSurfaceHeader";
import type {
    CandidateCoachPlanCategoryReference,
    CandidateCoachPlanQuestionReference,
    CandidateCoachPlanReference,
} from "./candidate-coach-plan-reference";
import type { CandidateCoachUpdateQuestionDetail } from "./candidate-coach-update-detail";
import type {
    CandidateQuestionPreparednessItem,
    CandidateQuestionPreparednessProgress,
} from "./candidate-question-preparedness-progress";
import { CandidateAnswerReview } from "./CandidateAnswerReview";
import { CandidatePlanDial } from "./CandidatePlanDial";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";
import {
    CandidateNextRoundReviewFooter,
    useCandidateNextRoundBuilder,
} from "./CandidateNextRoundBuilderExperience";

type CoachPlanView = "questions" | "categories";
type CoachPlanPatternState = "not-practiced" | "emerging" | "clear" | "strong" | "incomplete" | "unavailable" | "unrated";

const coachPlanPatternStateOrder: CoachPlanPatternState[] = [
    "not-practiced",
    "emerging",
    "clear",
    "strong",
    "incomplete",
    "unavailable",
    "unrated",
];

const coachPlanPatternStateLabel: Record<CoachPlanPatternState, string> = {
    "not-practiced": "Not practiced",
    emerging: "Emerging",
    clear: "Clear",
    strong: "Strong",
    incomplete: "Incomplete",
    unavailable: "Unavailable",
    unrated: "Prep state unavailable",
};

export function CandidateCoachPlanReferenceDialog({
    answerReviews = [],
    plan,
    preparedness = null,
    initialPlanIncomplete = false,
    initialPlanAnsweredQuestionKeys = [],
    onClose,
}: {
    answerReviews?: CandidateCoachUpdateQuestionDetail[];
    plan: CandidateCoachPlanReference;
    preparedness?: CandidateQuestionPreparednessProgress | null;
    initialPlanIncomplete?: boolean;
    initialPlanAnsweredQuestionKeys?: string[];
    onClose: () => void;
}) {
    const [view, setView] = useState<CoachPlanView>("questions");
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState(plan.questions[0]?.category ?? plan.categories[0]?.category ?? null);
    const [revealedQuestionKeys, setRevealedQuestionKeys] = useState<Set<string>>(() => new Set());
    const dialogRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const backdropRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const selectedQuestion = plan.questions[selectedQuestionIndex] ?? plan.questions[0] ?? null;
    const activeCategory = plan.categories.find((category) => category.category === selectedCategory)
        ?? plan.categories[0]
        ?? null;
    const preparednessByQuestion = useMemo(() => new Map(
        preparedness?.questions.map((question) => [question.questionKey, question]) ?? [],
    ), [preparedness]);
    const answerReviewByQuestion = useMemo(() => new Map(
        answerReviews.map((item) => [item.canonicalQuestion.questionKey, item]),
    ), [answerReviews]);
    const planDialQuestions = useMemo(() => plan.questions.map((question) => {
        const presentation = getQuestionPresentation(
            question,
            preparednessByQuestion.get(question.questionKey),
        );
        return {
            questionKey: question.questionKey,
            questionNumber: question.questionNumber,
            state: presentation.key,
            stateLabel: presentation.label,
        };
    }), [plan.questions, preparednessByQuestion]);
    const strongQuestionCount = planDialQuestions.filter((question) => question.state === "strong").length;
    const nextRoundBuilder = useCandidateNextRoundBuilder();
    const isBuilderOpen = Boolean(nextRoundBuilder?.isOpen);
    const isBuilderOpenRef = useRef(isBuilderOpen);

    useEffect(() => {
        isBuilderOpenRef.current = isBuilderOpen;
        const backdrop = backdropRef.current;
        if (!backdrop) return;
        if (isBuilderOpen) backdrop.setAttribute("inert", "");
        else backdrop.removeAttribute("inert");
        return () => backdrop.removeAttribute("inert");
    }, [isBuilderOpen]);

    useEffect(() => {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (isBuilderOpenRef.current) return;
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href]:not([tabindex="-1"]), summary, [tabindex]:not([tabindex="-1"])',
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

    const selectView = (nextView: CoachPlanView, focusTab = false) => {
        if (nextView === "categories" && selectedQuestion) setSelectedCategory(selectedQuestion.category);
        setView(nextView);
        if (focusTab) {
            window.requestAnimationFrame(() => {
                document.getElementById(`candidate-coach-plan-view-${nextView}`)?.focus();
            });
        }
    };

    const handleViewKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentView: CoachPlanView) => {
        let nextView: CoachPlanView | null = null;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            nextView = currentView === "questions" ? "categories" : "questions";
        }
        if (event.key === "Home") nextView = "questions";
        if (event.key === "End") nextView = "categories";
        if (!nextView) return;
        event.preventDefault();
        selectView(nextView, true);
    };

    const selectQuestion = (index: number, focusTab = false) => {
        const nextIndex = Math.min(Math.max(index, 0), plan.questions.length - 1);
        setSelectedQuestionIndex(nextIndex);
        setView("questions");
        if (focusTab) {
            window.requestAnimationFrame(() => {
                document.getElementById(`candidate-coach-plan-question-${nextIndex}`)?.focus();
            });
        }
    };

    const handleQuestionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
        let nextIndex: number | null = null;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % plan.questions.length;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + plan.questions.length) % plan.questions.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = plan.questions.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        selectQuestion(nextIndex, true);
    };

    return (
        <div
            ref={backdropRef}
            className="candidate-coach-plan-backdrop"
            data-testid="coach-plan-backdrop"
            aria-hidden={isBuilderOpen || undefined}
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                className="candidate-coach-plan-dialog"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-coach-plan-title"
            >
                <CandidateOpenedSurfaceHeader
                    className="candidate-coach-plan-dialog__header"
                    closeButtonRef={closeButtonRef}
                    closeLabel="Close Coach Plan"
                    context="Coach plan"
                    navigation={(
                        <div className="candidate-coach-plan-view-tabs" role="tablist" aria-label="Coach plan views">
                            {(["questions", "categories"] as const).map((item) => (
                                <button
                                    key={item}
                                    id={`candidate-coach-plan-view-${item}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === item}
                                    aria-controls={item === "questions"
                                        ? "candidate-coach-plan-question-panel"
                                        : "candidate-coach-plan-panel-categories"}
                                    tabIndex={view === item ? 0 : -1}
                                    onClick={() => selectView(item)}
                                    onKeyDown={(event) => handleViewKeyDown(event, item)}
                                >
                                    {item === "questions" ? "Questions" : "Categories"}
                                </button>
                            ))}
                        </div>
                    )}
                    onClose={onClose}
                    title={plan.targetRole}
                    titleId="candidate-coach-plan-title"
                />

                <div className="candidate-coach-plan-dialog__body candidate-coach-plan-workspace">
                    <aside className="candidate-coach-plan-map" aria-label="Coach plan map">
                        <CandidatePlanDial
                            aria-label={`${strongQuestionCount} of ${plan.questionCount} questions are Strong. Question states are shown clockwise from question 1.`}
                            className="candidate-coach-plan-map__dial is-interactive"
                            interactive={view === "questions"}
                            layout="reference"
                            material="neutral"
                            nodeIdPrefix="candidate-coach-plan-question"
                            onSelectQuestion={(index) => selectQuestion(index)}
                            onQuestionKeyDown={handleQuestionKeyDown}
                            panelId="candidate-coach-plan-question-panel"
                            questions={planDialQuestions}
                            selectedQuestionIndex={selectedQuestionIndex}
                            showQuestionIdentityOnStrong
                        />
                    </aside>

                    {view === "questions" && selectedQuestion ? (
                        <QuestionDetail
                            answerReview={answerReviewByQuestion.get(selectedQuestion.questionKey) ?? null}
                            isRevealed={selectedQuestion.evidenceStatus === "practiced"
                                || revealedQuestionKeys.has(selectedQuestion.questionKey)}
                            plan={plan}
                            preparedness={preparednessByQuestion.get(selectedQuestion.questionKey)}
                            question={selectedQuestion}
                            questionIndex={selectedQuestionIndex}
                            initialPlanIncomplete={initialPlanIncomplete}
                            initialPlanQuestionAnswered={initialPlanAnsweredQuestionKeys.includes(
                                selectedQuestion.questionKey,
                            )}
                            onReveal={() => setRevealedQuestionKeys((current) => (
                                new Set(current).add(selectedQuestion.questionKey)
                            ))}
                        />
                    ) : null}

                    {view === "categories" ? (
                        <CategoryView
                            activeCategory={activeCategory}
                            plan={plan}
                            preparednessByQuestion={preparednessByQuestion}
                            onSelectCategory={setSelectedCategory}
                        />
                    ) : null}
                </div>
                <CandidateNextRoundReviewFooter className="candidate-next-round-review-footer--sheet" />
            </section>
        </div>
    );
}

function QuestionDetail({
    answerReview,
    isRevealed,
    onReveal,
    plan,
    preparedness,
    question,
    questionIndex,
    initialPlanIncomplete,
    initialPlanQuestionAnswered,
}: {
    answerReview: CandidateCoachUpdateQuestionDetail | null;
    isRevealed: boolean;
    onReveal: () => void;
    plan: CandidateCoachPlanReference;
    preparedness?: CandidateQuestionPreparednessItem;
    question: CandidateCoachPlanQuestionReference;
    questionIndex: number;
    initialPlanIncomplete: boolean;
    initialPlanQuestionAnswered: boolean;
}) {
    const category = plan.categories.find((item) => item.category === question.category) ?? null;
    const state = getQuestionPresentation(question, preparedness);

    return (
        <section
            className="candidate-coach-plan-question-panel candidate-coach-plan-detail"
            id="candidate-coach-plan-question-panel"
            role="tabpanel"
            aria-labelledby={`candidate-coach-plan-question-${questionIndex}`}
        >
            <header>
                <div>
                    <p>Question {question.questionNumber} of {plan.questionCount} &middot; {question.categoryLabel}</p>
                    <h3>
                        {isRevealed
                            ? question.questionText ?? `Planned ${question.categoryLabel.toLowerCase()} question`
                            : `Upcoming ${question.categoryLabel.toLowerCase()} question`}
                    </h3>
                </div>
                <span className="candidate-coach-plan-status" data-state={state.key}>{state.label}</span>
            </header>

            {isRevealed ? (
                <>
                    {category ? (
                        <section className="candidate-coach-plan-guidance surface-plan" aria-label="Answer guidance">
                            <WorkflowTimeline
                                aria-label={`Answer shape for question ${question.questionNumber}`}
                                className="candidate-coach-plan-answer-map"
                            >
                                {category.teaching.answerShape.map((item, index) => (
                                    <WorkflowTimelineStep
                                        key={item}
                                        nodeClassName="on-color-glass"
                                        number={index + 1}
                                        state="upcoming"
                                        title={item}
                                    >
                                        <p>{item}</p>
                                    </WorkflowTimelineStep>
                                ))}
                            </WorkflowTimeline>

                            {category.teaching.watchFor[0] ? (
                                <aside className="candidate-coach-plan-watch on-color-glass">
                                    <strong>Watch for</strong>
                                    <p>{category.teaching.watchFor[0]}</p>
                                </aside>
                            ) : null}
                        </section>
                    ) : null}

                    {answerReview ? (
                        <details className="candidate-coach-plan-answer-review">
                            <summary>Review your answer</summary>
                            <CandidateAnswerReview item={answerReview} isCurrent />
                        </details>
                    ) : null}

                    {question.questionText && (!initialPlanIncomplete || !initialPlanQuestionAnswered) ? (
                        <div className="candidate-coach-plan-question-actions">
                            {initialPlanIncomplete ? (
                                <a
                                    className="candidate-question-practice-actions__primary"
                                    href={`/candidate/session/${encodeURIComponent(plan.source.baselineCandidatePracticeSessionId)}?pace=one&question=${encodeURIComponent(question.questionKey)}`}
                                >
                                    Practice this now
                                    <ArrowRight size={16} aria-hidden="true" />
                                </a>
                            ) : (
                                <CandidateQuestionPracticeActions
                                    pointer={{
                                        rootCandidatePracticeSessionId: plan.source.baselineCandidatePracticeSessionId,
                                        rootQuestionKey: question.questionKey,
                                    }}
                                />
                            )}
                        </div>
                    ) : null}
                </>
            ) : (
                <div className="candidate-coach-plan-question-hidden">
                    <p>Upcoming wording stays hidden until you choose to see it.</p>
                    <button type="button" onClick={onReveal}>
                        <Eye size={16} aria-hidden="true" />
                        Reveal question
                    </button>
                </div>
            )}
        </section>
    );
}

function CategoryView({
    activeCategory,
    onSelectCategory,
    plan,
    preparednessByQuestion,
}: {
    activeCategory: CandidateCoachPlanCategoryReference | null;
    onSelectCategory: (category: CandidateCoachPlanCategoryReference["category"]) => void;
    plan: CandidateCoachPlanReference;
    preparednessByQuestion: Map<string, CandidateQuestionPreparednessItem>;
}) {
    if (!activeCategory) return null;
    const rows = plan.categories.map((category) => {
        const questions = plan.questions
            .filter((question) => question.category === category.category)
            .map((question) => ({
                question,
                state: getQuestionPresentation(
                    question,
                    preparednessByQuestion.get(question.questionKey),
                ).key,
            }));
        return {
            category,
            questions,
            isUnavailable: questions.length !== category.plannedCount,
        };
    });
    const visibleStates = coachPlanPatternStateOrder.filter((state) => rows.some((row) => (
        (row.isUnavailable && state === "unavailable")
        || (!row.isUnavailable && row.questions.some((question) => question.state === state))
    )));
    const gridStyle = { "--pattern-state-count": Math.max(1, visibleStates.length) } as CSSProperties;
    const patternSummary = rows.map((row) => {
        if (row.isUnavailable) return `${row.category.label}: unavailable`;
        return `${row.category.label}: ${row.questions
            .map(({ question, state }) => `question ${question.questionNumber} ${coachPlanPatternStateLabel[state]}`)
            .join(", ")}`;
    }).join(". ");

    return (
        <section
            id="candidate-coach-plan-panel-categories"
            className="candidate-coach-plan-category-view candidate-coach-plan-detail candidate-coach-plan-detail--categories"
            role="tabpanel"
            aria-labelledby="candidate-coach-plan-view-categories"
        >
            <section className="candidate-coach-plan-category-pattern surface-plan" aria-label="Question status by category">
                <p className="candidate-coach-plan-category-pattern__count">
                    {plan.practicedQuestionCount} of {plan.questionCount} practiced
                </p>
                <div className="candidate-coach-plan-category-pattern__table on-color-glass">
                    <div className="candidate-coach-plan-category-pattern__axis" style={gridStyle} aria-hidden="true">
                        <span>Category</span>
                        <span className="candidate-coach-plan-category-pattern__lanes">
                            {visibleStates.map((state) => <i key={state}>{coachPlanPatternStateLabel[state]}</i>)}
                        </span>
                    </div>
                    <ul className="candidate-coach-plan-category-pattern__rows">
                        {rows.map((row) => {
                            const isSelected = activeCategory.category === row.category.category;
                            const accessibleState = row.isUnavailable
                                ? "Category status unavailable"
                                : row.questions
                                    .map(({ question, state }) => `Question ${question.questionNumber}, ${coachPlanPatternStateLabel[state]}`)
                                    .join("; ");
                            return (
                                <li key={row.category.category}>
                                    <button
                                        type="button"
                                        className="candidate-coach-plan-category-pattern__row"
                                        style={gridStyle}
                                        aria-pressed={isSelected}
                                        aria-label={`${row.category.label}. ${accessibleState}`}
                                        onClick={() => onSelectCategory(row.category.category)}
                                    >
                                        <span className="candidate-coach-plan-category-pattern__label">
                                            <strong>{row.category.label}</strong>
                                        </span>
                                        <span className="candidate-coach-plan-category-pattern__lanes" aria-hidden="true">
                                            {visibleStates.map((state) => (
                                                <span
                                                    key={state}
                                                    className="candidate-coach-plan-category-pattern__lane"
                                                    data-state={state}
                                                    data-label={coachPlanPatternStateLabel[state]}
                                                >
                                                    {row.isUnavailable && state === "unavailable" ? <i><span>&mdash;</span></i> : null}
                                                    {!row.isUnavailable ? row.questions
                                                        .filter((question) => question.state === state)
                                                        .map(({ question }) => (
                                                            <i key={question.questionKey}>
                                                                <span>Q{question.questionNumber}</span>
                                                                {state === "strong"
                                                                    ? <Check size={10} strokeWidth={3.2} aria-hidden="true" />
                                                                    : null}
                                                            </i>
                                                        )) : null}
                                                </span>
                                            ))}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <p className="sr-only">{patternSummary}</p>
            </section>

            <article
                className="candidate-coach-plan-category-focus candidate-coach-plan-guidance candidate-coach-plan-guidance--light"
                aria-label={`${activeCategory.label} answer guidance`}
            >
                <WorkflowTimeline
                    aria-label={`Answer shape for ${activeCategory.label}`}
                    className="candidate-coach-plan-answer-map"
                >
                    {activeCategory.teaching.answerShape.map((item, index) => (
                        <WorkflowTimelineStep
                            key={item}
                            number={index + 1}
                            state="upcoming"
                            title={item}
                        >
                            <p>{item}</p>
                        </WorkflowTimelineStep>
                    ))}
                </WorkflowTimeline>
                {activeCategory.teaching.watchFor[0] ? (
                    <aside className="candidate-coach-plan-watch candidate-coach-plan-watch--light">
                        <strong>Watch for</strong>
                        <p>{activeCategory.teaching.watchFor[0]}</p>
                    </aside>
                ) : null}
            </article>
        </section>
    );
}

function getQuestionPresentation(
    question: CandidateCoachPlanQuestionReference,
    preparedness?: CandidateQuestionPreparednessItem,
): { key: CoachPlanPatternState; label: string } {
    if (preparedness?.state === "rated" && preparedness.band) {
        return {
            key: preparedness.band,
            label: preparedness.band.charAt(0).toUpperCase() + preparedness.band.slice(1),
        };
    }
    if (preparedness?.state === "incomplete") return { key: "incomplete", label: "Needs a complete answer" };
    if (preparedness?.state === "evaluation_unavailable") return { key: "unavailable", label: "Coaching unavailable" };
    if (preparedness?.state === "not_practiced" || question.evidenceStatus === "missing_evidence") {
        return { key: "not-practiced", label: "Not practiced yet" };
    }
    return { key: "unrated", label: "Prep state unavailable" };
}
