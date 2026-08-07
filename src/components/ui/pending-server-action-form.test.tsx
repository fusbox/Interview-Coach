import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
    PendingServerActionForm,
    PendingSubmitButton,
} from "./pending-server-action-form";

describe("PendingServerActionForm", () => {
    it("marks the selected mutation busy and blocks every duplicate submit", () => {
        const action = vi.fn(async () => undefined);
        render(
            <PendingServerActionForm action={action} aria-label="Draft controls">
                <PendingSubmitButton name="intent" value="save">
                    Save
                </PendingSubmitButton>
                <PendingSubmitButton name="intent" value="stage">
                    Stage
                </PendingSubmitButton>
            </PendingServerActionForm>,
        );

        const form = screen.getByRole("form", { name: "Draft controls" });
        const save = screen.getByRole("button", { name: "Save" });
        const stage = screen.getByRole("button", { name: "Stage" });
        const firstSubmit = new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
            submitter: stage,
        });
        const submittedData = new FormData(form as HTMLFormElement, stage as HTMLButtonElement);

        expect(submittedData.get("intent")).toBe("stage");

        fireEvent(form, firstSubmit);

        expect(form).toHaveAttribute("aria-busy", "true");
        expect(save).toBeDisabled();
        expect(stage).toBeDisabled();
        expect(save).not.toHaveAttribute("aria-busy");
        expect(stage).toHaveAttribute("aria-busy", "true");
        expect(stage).toHaveAttribute("data-state", "loading");
        expect(screen.getByRole("status")).toHaveTextContent("Submitting request.");

        const duplicateSubmit = new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
            submitter: save,
        });
        fireEvent(form, duplicateSubmit);

        expect(duplicateSubmit.defaultPrevented).toBe(true);
        expect(stage).toHaveAttribute("aria-busy", "true");
        expect(save).not.toHaveAttribute("aria-busy");
    });

    it("covers every AI-eval server-action form without changing read-only GET forms", () => {
        const featureFiles = [
            "AiEvalScenarioWorkspaceExperience.tsx",
            "AiEvalScenarioCaseList.tsx",
            "AiEvalWorkbenchExperience.tsx",
        ].map((fileName) =>
            readFileSync(join(process.cwd(), "src", "features", "ai-eval-v2", fileName), "utf8"),
        );
        const combinedSource = featureFiles.join("\n");

        expect(combinedSource.match(/<PendingServerActionForm\b/g)).toHaveLength(15);
        expect(combinedSource).not.toMatch(
            /<form[^>]*action=\{(?:create|link|mutate|promote|record|run|start|update)AiEval/,
        );
        expect(combinedSource).toContain('<form className="ai-eval-filters" method="get">');
        expect(combinedSource).toContain('action="/qa/ai-eval" method="get"');
    });
});
