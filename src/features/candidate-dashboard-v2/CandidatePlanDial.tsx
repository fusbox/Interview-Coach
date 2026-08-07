import { Check } from "lucide-react";
import {
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { cn } from "@/lib/cn";

export type CandidatePlanDialState =
    | "not-practiced"
    | "emerging"
    | "clear"
    | "strong"
    | "incomplete"
    | "unavailable"
    | "unrated";

export type CandidatePlanDialQuestion = {
    questionKey: string;
    questionNumber: number;
    state: CandidatePlanDialState;
    stateLabel: string;
};

type CandidatePlanDialProps = {
    "aria-label": string;
    className?: string;
    decorative?: boolean;
    interactive?: boolean;
    layout?: "card" | "reference";
    material?: "plan" | "neutral";
    nodeIdPrefix?: string;
    onQuestionKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
    onSelectQuestion?: (index: number) => void;
    panelId?: string;
    questions: CandidatePlanDialQuestion[];
    selectedQuestionIndex?: number;
    showLegend?: boolean;
    showQuestionIdentityOnStrong?: boolean;
};

export function CandidatePlanDial({
    "aria-label": ariaLabel,
    className,
    decorative = false,
    interactive = false,
    layout = "card",
    material = "plan",
    nodeIdPrefix = "candidate-plan-question",
    onQuestionKeyDown,
    onSelectQuestion,
    panelId,
    questions,
    selectedQuestionIndex = 0,
    showLegend = true,
    showQuestionIdentityOnStrong = false,
}: CandidatePlanDialProps) {
    const totalCount = questions.length;
    const strongCount = questions.filter((question) => question.state === "strong").length;
    const strongPercent = totalCount > 0 ? Math.round((strongCount / totalCount) * 100) : 0;
    const visibleStates = questions.reduce<CandidatePlanDialQuestion[]>((states, question) => (
        states.some((item) => item.state === question.state) ? states : [...states, question]
    ), []);

    if (totalCount === 0) return null;

    return (
        <div className={cn(
            "candidate-dashboard-plan-dial-cluster",
            `candidate-plan-dial--layout-${layout}`,
            `candidate-plan-dial--material-${material}`,
            className,
        )}>
            <div
                className="candidate-dashboard-plan-dial"
                role={decorative ? undefined : interactive ? "group" : "img"}
                aria-label={decorative ? undefined : ariaLabel}
                aria-hidden={decorative || undefined}
            >
                <div className="candidate-dashboard-plan-gauge candidate-dashboard-plan-dial__gauge" aria-hidden="true">
                    <svg viewBox="0 0 120 120">
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
                    <span><strong>{strongCount}</strong><small>of {totalCount}</small><em>Strong</em></span>
                </div>

                <ol
                    className="candidate-dashboard-plan-dial__questions"
                    role={interactive ? "tablist" : undefined}
                    aria-label={interactive ? "Coach plan questions" : undefined}
                    aria-hidden={interactive ? undefined : true}
                >
                    {questions.map((question, index) => {
                        const angle = -90 + ((360 / totalCount) * index);
                        const isSelected = interactive && selectedQuestionIndex === index;
                        const nodeContent = (
                            <span className="candidate-dashboard-plan-dial__node-content">
                                {question.state === "strong" && !showQuestionIdentityOnStrong ? (
                                    <Check size={15} strokeWidth={2.8} aria-hidden="true" />
                                ) : (
                                    <>
                                        <span>Q{question.questionNumber}</span>
                                        {question.state === "strong" ? (
                                            <Check
                                                className="candidate-dashboard-plan-dial__node-check"
                                                size={10}
                                                strokeWidth={3.2}
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                    </>
                                )}
                            </span>
                        );

                        return (
                            <li
                                key={question.questionKey}
                                role={interactive ? "presentation" : undefined}
                                data-plan-question=""
                                data-state={question.state}
                                data-band={question.state}
                                data-selected={isSelected || undefined}
                                style={{ "--plan-node-angle": `${angle}deg` } as CSSProperties}
                            >
                                {interactive ? (
                                    <button
                                        id={`${nodeIdPrefix}-${index}`}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        aria-controls={panelId}
                                        aria-label={`Question ${question.questionNumber}: ${question.stateLabel}`}
                                        tabIndex={isSelected ? 0 : -1}
                                        onClick={() => onSelectQuestion?.(index)}
                                        onKeyDown={(event) => onQuestionKeyDown?.(event, index)}
                                    >
                                        {nodeContent}
                                    </button>
                                ) : nodeContent}
                            </li>
                        );
                    })}
                </ol>
            </div>

            {showLegend ? (
                <div className="candidate-dashboard-plan-dial__legend" aria-hidden="true">
                    {visibleStates.map((question) => (
                        <span key={question.state} data-band={question.state}>
                            <i />
                            {question.stateLabel}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
