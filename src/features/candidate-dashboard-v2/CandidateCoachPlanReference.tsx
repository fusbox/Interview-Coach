"use client";

import {
    Check,
    ChevronRight,
    Eye,
    X,
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";

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
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";

type CoachPlanView = "questions" | "categories";

export function CandidateCoachPlanReferenceDialog({
    answerReviews = [],
    plan,
    preparedness = null,
    onClose,
}: {
    answerReviews?: CandidateCoachUpdateQuestionDetail[];
    plan: CandidateCoachPlanReference;
    preparedness?: CandidateQuestionPreparednessProgress | null;
    onClose: () => void;
}) {
    const [view, setView] = useState<CoachPlanView>("questions");
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState(plan.questions[0]?.category ?? plan.categories[0]?.category ?? null);
    const [revealedQuestionKeys, setRevealedQuestionKeys] = useState<Set<string>>(() => new Set());
    const dialogRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const selectedQuestion = plan.questions[selectedQuestionIndex] ?? plan.questions[0] ?? null;
    const activeCategory = plan.categories.find((category) => category.category === selectedCategory)
        ?? plan.categories[0]
        ?? null;
    const preparednessByQuestion = useMemo(() => new Map(
        preparedness?.questions.map((question) => [question.questionKey, question]) ?? [],
    ), [preparedness]);
    const answerReviewByQuestion = useMemo(() => new Map(
        answerReviews.map((item) => [item.questionKey, item]),
    ), [answerReviews]);

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
            className="candidate-coach-plan-backdrop"
            data-testid="coach-plan-backdrop"
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
                <header className="candidate-coach-plan-dialog__header">
                    <div>
                        <p className="type-eyebrow">Coach plan</p>
                        <h2 id="candidate-coach-plan-title">{plan.targetRole}</h2>
                    </div>
                    <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close Coach Plan">
                        <X size={19} aria-hidden="true" />
                    </button>
                </header>

                <div className="candidate-coach-plan-dialog__body">
                    <section className="candidate-coach-plan-purpose" aria-labelledby="candidate-coach-plan-purpose-title">
                        <p className="type-eyebrow">Why this plan</p>
                        <h3 id="candidate-coach-plan-purpose-title">
                            Prepare for the range of your {plan.stage.label.toLowerCase()}.
                        </h3>
                        <p>
                            {plan.questionCount} questions cover {formatCategoryList(plan.categories)} for {plan.targetRole}.
                        </p>
                    </section>

                    <div className="candidate-coach-plan-view-tabs" role="tablist" aria-label="Coach plan views">
                        {(["questions", "categories"] as const).map((item) => (
                            <button
                                key={item}
                                id={`candidate-coach-plan-view-${item}`}
                                type="button"
                                role="tab"
                                aria-selected={view === item}
                                aria-controls={`candidate-coach-plan-panel-${item}`}
                                tabIndex={view === item ? 0 : -1}
                                onClick={() => selectView(item)}
                                onKeyDown={(event) => handleViewKeyDown(event, item)}
                            >
                                {item === "questions" ? "Questions" : "Categories"}
                            </button>
                        ))}
                    </div>

                    {view === "questions" ? (
                        <div
                            id="candidate-coach-plan-panel-questions"
                            className="candidate-coach-plan-question-view"
                            role="tabpanel"
                            aria-labelledby="candidate-coach-plan-view-questions"
                        >
                            <div
                                className="candidate-coach-plan-question-tabs"
                                role="tablist"
                                aria-label="Coach plan questions"
                                style={{ "--coach-plan-question-count": plan.questions.length } as CSSProperties}
                            >
                                {plan.questions.map((question, index) => {
                                    const state = getQuestionPresentation(
                                        question,
                                        preparednessByQuestion.get(question.questionKey),
                                    );
                                    const isSelected = selectedQuestionIndex === index;
                                    return (
                                        <button
                                            key={question.questionKey}
                                            id={`candidate-coach-plan-question-${index}`}
                                            type="button"
                                            role="tab"
                                            aria-selected={isSelected}
                                            aria-controls="candidate-coach-plan-question-panel"
                                            aria-label={`Question ${question.questionNumber}: ${state.label}`}
                                            tabIndex={isSelected ? 0 : -1}
                                            onClick={() => selectQuestion(index)}
                                            onKeyDown={(event) => handleQuestionKeyDown(event, index)}
                                        >
                                            <span>Q{question.questionNumber}</span>
                                            <span className="candidate-coach-plan-question-tabs__state" data-state={state.key} aria-hidden="true">
                                                {state.key === "strong" ? <Check size={8} strokeWidth={3.2} /> : null}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedQuestion ? (
                                <QuestionDetail
                                    answerReview={answerReviewByQuestion.get(selectedQuestion.questionKey) ?? null}
                                    isRevealed={selectedQuestion.evidenceStatus === "practiced"
                                        || revealedQuestionKeys.has(selectedQuestion.questionKey)}
                                    plan={plan}
                                    preparedness={preparednessByQuestion.get(selectedQuestion.questionKey)}
                                    question={selectedQuestion}
                                    onReveal={() => setRevealedQuestionKeys((current) => (
                                        new Set(current).add(selectedQuestion.questionKey)
                                    ))}
                                />
                            ) : null}
                        </div>
                    ) : (
                        <CategoryView
                            activeCategory={activeCategory}
                            plan={plan}
                            preparednessByQuestion={preparednessByQuestion}
                            revealedQuestionKeys={revealedQuestionKeys}
                            onSelectCategory={setSelectedCategory}
                            onSelectQuestion={(questionKey) => {
                                const index = plan.questions.findIndex((question) => question.questionKey === questionKey);
                                if (index >= 0) selectQuestion(index, true);
                            }}
                        />
                    )}
                </div>
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
}: {
    answerReview: CandidateCoachUpdateQuestionDetail | null;
    isRevealed: boolean;
    onReveal: () => void;
    plan: CandidateCoachPlanReference;
    preparedness?: CandidateQuestionPreparednessItem;
    question: CandidateCoachPlanQuestionReference;
}) {
    const category = plan.categories.find((item) => item.category === question.category) ?? null;
    const state = getQuestionPresentation(question, preparedness);

    return (
        <section
            className="candidate-coach-plan-question-panel"
            id="candidate-coach-plan-question-panel"
            role="tabpanel"
            aria-labelledby={`candidate-coach-plan-question-${question.questionNumber - 1}`}
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
                        <div className="candidate-coach-plan-question-guide" aria-label={`How to build answer ${question.questionNumber}`}>
                            {category.teaching.answerShape.map((item, index) => (
                                <section key={item}>
                                    <span>{index + 1}</span>
                                    <p>{item}</p>
                                </section>
                            ))}
                            {category.teaching.watchFor[0] ? (
                                <aside>
                                    <strong>Watch for</strong>
                                    <p>{category.teaching.watchFor[0]}</p>
                                </aside>
                            ) : null}
                        </div>
                    ) : null}

                    {answerReview ? (
                        <details className="candidate-coach-plan-answer-review">
                            <summary>Review your answer</summary>
                            <CandidateAnswerReview item={answerReview} isCurrent />
                        </details>
                    ) : null}

                    {question.questionText ? (
                        <div className="candidate-coach-plan-question-actions">
                            <CandidateQuestionPracticeActions
                                pointer={{
                                    rootCandidatePracticeSessionId: plan.source.baselineCandidatePracticeSessionId,
                                    rootQuestionKey: question.questionKey,
                                }}
                            />
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
    onSelectQuestion,
    plan,
    preparednessByQuestion,
    revealedQuestionKeys,
}: {
    activeCategory: CandidateCoachPlanCategoryReference | null;
    onSelectCategory: (category: CandidateCoachPlanCategoryReference["category"]) => void;
    onSelectQuestion: (questionKey: string) => void;
    plan: CandidateCoachPlanReference;
    preparednessByQuestion: Map<string, CandidateQuestionPreparednessItem>;
    revealedQuestionKeys: Set<string>;
}) {
    if (!activeCategory) return null;
    const categoryQuestions = plan.questions.filter((question) => question.category === activeCategory.category);
    const strongCount = categoryQuestions.filter((question) => {
        const item = preparednessByQuestion.get(question.questionKey);
        return item?.state === "rated" && item.band === "strong";
    }).length;
    const hasPreparedness = categoryQuestions.some((question) => preparednessByQuestion.has(question.questionKey));

    return (
        <div
            id="candidate-coach-plan-panel-categories"
            className="candidate-coach-plan-category-view"
            role="tabpanel"
            aria-labelledby="candidate-coach-plan-view-categories"
        >
            <div className="candidate-coach-plan-category-list" aria-label="Plan categories">
                {plan.categories.map((category) => {
                    const questions = plan.questions.filter((question) => question.category === category.category);
                    const categoryStrong = questions.filter((question) => {
                        const item = preparednessByQuestion.get(question.questionKey);
                        return item?.state === "rated" && item.band === "strong";
                    }).length;
                    const categoryHasPreparedness = questions.some((question) => preparednessByQuestion.has(question.questionKey));
                    return (
                        <button
                            key={category.category}
                            type="button"
                            aria-pressed={activeCategory.category === category.category}
                            onClick={() => onSelectCategory(category.category)}
                        >
                            <span>{category.label}</span>
                            <strong>
                                {categoryHasPreparedness
                                    ? `${categoryStrong} of ${questions.length} Strong`
                                    : `${questions.length} ${questions.length === 1 ? "question" : "questions"}`}
                            </strong>
                        </button>
                    );
                })}
            </div>

            <article className="candidate-coach-plan-category-teaching">
                <header>
                    <p>{activeCategory.label} questions</p>
                    <h3>{activeCategory.purpose}</h3>
                    <span>{activeCategory.teaching.definition}</span>
                </header>
                <div className="candidate-coach-plan-category-teaching__guidance">
                    <section>
                        <h4>A useful answer shape</h4>
                        <ol>
                            {activeCategory.teaching.answerShape.map((item) => <li key={item}>{item}</li>)}
                        </ol>
                    </section>
                    <section>
                        <h4>Watch for</h4>
                        <p>{activeCategory.teaching.watchFor[0]}</p>
                    </section>
                </div>
                <section className="candidate-coach-plan-category-questions">
                    <header>
                        <h4>Questions in this category</h4>
                        <span>{hasPreparedness ? `${strongCount} of ${categoryQuestions.length} Strong` : `${categoryQuestions.length} total`}</span>
                    </header>
                    <ul>
                        {categoryQuestions.map((question) => {
                            const state = getQuestionPresentation(
                                question,
                                preparednessByQuestion.get(question.questionKey),
                            );
                            const visible = question.evidenceStatus === "practiced"
                                || revealedQuestionKeys.has(question.questionKey);
                            return (
                                <li key={question.questionKey}>
                                    <button type="button" onClick={() => onSelectQuestion(question.questionKey)}>
                                        <span>Q{question.questionNumber}</span>
                                        <span>
                                            {visible
                                                ? question.questionText ?? `Planned ${question.categoryLabel.toLowerCase()} question`
                                                : `Upcoming ${question.categoryLabel.toLowerCase()} question`}
                                        </span>
                                        <span className="candidate-coach-plan-status" data-state={state.key}>{state.label}</span>
                                        <ChevronRight size={17} aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            </article>
        </div>
    );
}

function getQuestionPresentation(
    question: CandidateCoachPlanQuestionReference,
    preparedness?: CandidateQuestionPreparednessItem,
) {
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

function formatCategoryList(categories: CandidateCoachPlanCategoryReference[]) {
    const labels = categories.map((category) => category.label.toLowerCase());
    if (labels.length === 0) return "the expected interview range";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}
