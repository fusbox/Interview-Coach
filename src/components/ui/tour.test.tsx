import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { TourProvider, useTour, type Tour } from "./tour";

function StartTourButton() {
    const tour = useTour();

    return (
        <button type="button" onClick={() => tour.start("demo-tour")}>
            Start Tour
        </button>
    );
}

describe("TourProvider", () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const originalResizeObserver = globalThis.ResizeObserver;

    beforeAll(() => {
        HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
            return new DOMRect(120, 80, 240, 64);
        };
        HTMLElement.prototype.scrollIntoView = vi.fn();
        globalThis.ResizeObserver = class ResizeObserver {
            observe() {}
            disconnect() {}
            unobserve() {}
        };
    });

    afterAll(() => {
        HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
        globalThis.ResizeObserver = originalResizeObserver;
    });

    it("starts a tour and completes it", async () => {
        const user = userEvent.setup();
        const handleComplete = vi.fn();

        const tours = [
            {
                id: "demo-tour",
                steps: [
                    {
                        id: "tour-target",
                        title: "Welcome",
                        content: "This is a demo tour step.",
                    },
                ],
            },
        ] satisfies Tour[];

        render(
            <TourProvider tours={tours} onComplete={handleComplete}>
                <div data-tour-step-id="tour-target">Target</div>
                <StartTourButton />
            </TourProvider>
        );

        await user.click(screen.getByRole("button", { name: "Start Tour" }));

        expect(await screen.findByText("Welcome")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Finish" }));

        expect(handleComplete).toHaveBeenCalledWith("demo-tour");
        expect(screen.queryByText("Welcome")).not.toBeInTheDocument();
    });
});
