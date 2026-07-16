"use client";

import {
    BookOpen,
    Check,
    Circle,
    Eye,
    EyeOff,
    X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
    CandidateCoachPlanCategoryReference,
    CandidateCoachPlanReference,
} from "./candidate-coach-plan-reference";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";

type CoachPlanView = "categories" | "question-set";

export function CandidateCoachPlanReferenceDialog({
    plan,
    onClose,
}: {
    plan: CandidateCoachPlanReference;
    onClose: () => void;
}) {
    const [view, setView] = useState<CoachPlanView>("categories");
    const [selectedCategory, setSelectedCategory] = useState(plan.categories[0]?.category ?? null);
    const [showMissingQuestions, setShowMissingQuestions] = useState(false);
    const dialogRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const activeCategory = useMemo(() => (
        plan.categories.find((category) => category.category === selectedCategory)
        ?? plan.categories[0]
        ?? null
    ), [plan.categories, selectedCategory]);

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
                    <BookOpen size={20} aria-hidden="true" />
                    <div>
                        <p className="type-eyebrow">Coach Plan</p>
                        <h2 id="candidate-coach-plan-title">Your plan for {plan.targetRole}</h2>
                    </div>
                    <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close Coach Plan">
                        <X size={19} aria-hidden="true" />
                    </button>
                </header>

                <div className="candidate-coach-plan-dialog__body">
                    <dl className="candidate-coach-plan-summary" aria-label="Coach Plan summary">
                        <div>
                            <dt>Interview stage</dt>
                            <dd>{plan.stage.label}</dd>
                        </div>
                        <div>
                            <dt>Baseline</dt>
                            <dd>{plan.questionCount} questions</dd>
                        </div>
                        <div>
                            <dt>Practice evidence</dt>
                            <dd>{plan.practicedQuestionCount} of {plan.questionCount} practiced</dd>
                        </div>
                    </dl>

                    <div className="candidate-coach-plan-tabs" role="tablist" aria-label="Coach Plan views">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={view === "categories"}
                            aria-controls="candidate-coach-plan-categories"
                            onClick={() => setView("categories")}
                        >
                            Categories
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={view === "question-set"}
                            aria-controls="candidate-coach-plan-question-set"
                            onClick={() => setView("question-set")}
                        >
                            Question set
                        </button>
                    </div>

                    {view === "categories" ? (
                        <CategoryView
                            plan={plan}
                            activeCategory={activeCategory}
                            onSelectCategory={setSelectedCategory}
                        />
                    ) : (
                        <QuestionSetView
                            plan={plan}
                            showMissingQuestions={showMissingQuestions}
                            onToggleMissing={() => setShowMissingQuestions((current) => !current)}
                        />
                    )}
                </div>
            </section>
        </div>
    );
}

function CategoryView({
    plan,
    activeCategory,
    onSelectCategory,
}: {
    plan: CandidateCoachPlanReference;
    activeCategory: CandidateCoachPlanCategoryReference | null;
    onSelectCategory: (category: CandidateCoachPlanCategoryReference["category"]) => void;
}) {
    return (
        <div className="candidate-coach-plan-category-view" id="candidate-coach-plan-categories" role="tabpanel">
            <div className="candidate-coach-plan-category-list" aria-label="Planned interview categories">
                {plan.categories.map((category) => {
                    const isSelected = activeCategory?.category === category.category;
                    const coverage = category.plannedCount > 0
                        ? (category.practicedCount / category.plannedCount) * 100
                        : 0;
                    return (
                        <button
                            key={category.category}
                            type="button"
                            className={isSelected ? "is-selected" : undefined}
                            aria-pressed={isSelected}
                            onClick={() => onSelectCategory(category.category)}
                        >
                            <span>
                                <strong>{category.label}</strong>
                                <span>{category.practicedCount} of {category.plannedCount} practiced</span>
                            </span>
                            <span className="candidate-coach-plan-coverage" aria-hidden="true">
                                <span style={{ width: `${coverage}%` }} />
                            </span>
                        </button>
                    );
                })}
            </div>

            {activeCategory ? (
                <article className="candidate-coach-plan-teaching">
                    <p className="type-eyebrow">{activeCategory.label}</p>
                    <h3>{activeCategory.purpose}</h3>
                    <p>{activeCategory.teaching.definition}</p>
                    <div className="candidate-coach-plan-teaching__columns">
                        <section>
                            <h4>A useful answer shape</h4>
                            <ul>{activeCategory.teaching.answerShape.map((item) => <li key={item}>{item}</li>)}</ul>
                        </section>
                        <section>
                            <h4>Watch for</h4>
                            <ul>{activeCategory.teaching.watchFor.map((item) => <li key={item}>{item}</li>)}</ul>
                        </section>
                    </div>
                </article>
            ) : null}
        </div>
    );
}

function QuestionSetView({
    plan,
    showMissingQuestions,
    onToggleMissing,
}: {
    plan: CandidateCoachPlanReference;
    showMissingQuestions: boolean;
    onToggleMissing: () => void;
}) {
    const practicedQuestions = plan.questions.filter((question) => question.evidenceStatus === "practiced");
    const missingQuestions = plan.questions.filter((question) => question.evidenceStatus === "missing_evidence");
    const visibleQuestions = showMissingQuestions ? plan.questions : practicedQuestions;

    return (
        <div className="candidate-coach-plan-question-view" id="candidate-coach-plan-question-set" role="tabpanel">
            <header>
                <div>
                    <p className="type-eyebrow">Baseline sequence</p>
                    <h3>{plan.practicedQuestionCount} of {plan.questionCount} questions practiced</h3>
                </div>
                {missingQuestions.length > 0 ? (
                    <button type="button" onClick={onToggleMissing} aria-expanded={showMissingQuestions}>
                        {showMissingQuestions ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                        {showMissingQuestions ? "Hide upcoming" : `Reveal ${missingQuestions.length} upcoming`}
                    </button>
                ) : null}
            </header>

            {visibleQuestions.length > 0 ? (
                <ol className="candidate-coach-plan-question-list">
                    {visibleQuestions.map((question) => (
                        <li key={question.questionKey}>
                            <span className={question.evidenceStatus === "practiced" ? "is-practiced" : undefined}>
                                {question.evidenceStatus === "practiced"
                                    ? <Check size={16} aria-hidden="true" />
                                    : <Circle size={14} aria-hidden="true" />}
                            </span>
                            <div className="candidate-coach-plan-question-list__content">
                                <p>Q{question.questionNumber} &middot; {question.categoryLabel}</p>
                                <strong>{question.questionText ?? `Planned ${question.categoryLabel.toLowerCase()} question`}</strong>
                                <span>{question.evidenceStatus === "practiced" ? "Practiced" : "Needs practice evidence"}</span>
                                {question.questionText ? (
                                    <CandidateQuestionPracticeActions
                                        pointer={{
                                            rootCandidatePracticeSessionId: plan.source.baselineCandidatePracticeSessionId,
                                            rootQuestionKey: question.questionKey,
                                        }}
                                    />
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="candidate-coach-plan-question-view__empty">
                    Your plan is ready. Upcoming wording stays hidden until you choose to reveal it.
                </p>
            )}
        </div>
    );
}
