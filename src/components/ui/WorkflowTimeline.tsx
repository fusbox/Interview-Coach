import { Check } from "lucide-react";
import {
    forwardRef,
    type HTMLAttributes,
    type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

export type WorkflowTimelineStepState = "upcoming" | "visited" | "active" | "complete";

type WorkflowTimelineProps = {
    "aria-label": string;
    children: ReactNode;
    className?: string;
};

export function WorkflowTimeline({
    "aria-label": ariaLabel,
    children,
    className,
}: WorkflowTimelineProps) {
    return (
        <ol className={cn("workflow-timeline", className)} aria-label={ariaLabel}>
            {children}
        </ol>
    );
}

type WorkflowTimelineStepProps = HTMLAttributes<HTMLLIElement> & {
    number: number;
    state: WorkflowTimelineStepState;
    title: string;
};

export const WorkflowTimelineStep = forwardRef<HTMLLIElement, WorkflowTimelineStepProps>(
    ({ children, className, number, state, title, ...props }, ref) => (
        <li
            ref={ref}
            className={cn("workflow-timeline__step", `is-${state}`, className)}
            data-workflow-step={number}
            data-workflow-state={state}
            {...props}
        >
            <div className="workflow-timeline__rail" aria-hidden="true">
                <span className="workflow-timeline__node">
                    {state === "complete" ? <Check size={17} /> : number}
                </span>
            </div>
            <div className="workflow-timeline__content">
                <span className="sr-only">
                    Step {number}: {title}{state === "active" ? ", current step" : ""}
                </span>
                {children}
            </div>
        </li>
    ),
);

WorkflowTimelineStep.displayName = "WorkflowTimelineStep";
