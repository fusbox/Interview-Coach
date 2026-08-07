import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { WorkflowTimeline, WorkflowTimelineStep } from "./WorkflowTimeline";

it("renders an accessible ordered workflow with explicit step states", () => {
    const { container } = render(
        <WorkflowTimeline aria-label="Setup progress">
            <WorkflowTimelineStep number={1} state="complete" title="Role">
                <section>Role content</section>
            </WorkflowTimelineStep>
            <WorkflowTimelineStep number={2} state="active" title="Resume">
                <section>Resume content</section>
            </WorkflowTimelineStep>
            <WorkflowTimelineStep
                nodeClassName="on-color-glass"
                number={3}
                state="upcoming"
                title="Interview details"
            >
                <section>Interview content</section>
            </WorkflowTimelineStep>
        </WorkflowTimeline>,
    );

    expect(screen.getByRole("list", { name: "Setup progress" })).toBeInTheDocument();
    expect(screen.getByText(/Step 2: Resume, current step/)).toBeInTheDocument();
    expect(container.querySelector('[data-workflow-step="1"]')).toHaveAttribute(
        "data-workflow-state",
        "complete",
    );
    expect(container.querySelector('[data-workflow-step="3"]')).toHaveAttribute(
        "data-workflow-state",
        "upcoming",
    );
    expect(container.querySelector('[data-workflow-step="3"] .workflow-timeline__node')).toHaveClass(
        "on-color-glass",
    );
});
