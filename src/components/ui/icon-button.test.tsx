import { render, screen } from "@testing-library/react";
import { Lightbulb } from "lucide-react";
import { describe, expect, it } from "vitest";

import { IconButton } from "./icon-button";

describe("IconButton", () => {
    it("requires and applies an accessible label", () => {
        render(
            <IconButton label="Show question hints" tone="accent" pressed>
                <Lightbulb aria-hidden="true" />
            </IconButton>,
        );

        const button = screen.getByRole("button", {
            name: "Show question hints",
        });
        expect(button).toHaveAttribute("aria-pressed", "true");
        expect(button).toHaveAttribute("data-tone", "accent");
        expect(button).toHaveAttribute("data-size", "default");
        expect(button).toHaveClass("ui-icon-button");
    });

    it("preserves its label while loading", () => {
        render(
            <IconButton label="Read question aloud" loading>
                <span aria-hidden="true">R</span>
            </IconButton>,
        );

        expect(
            screen.getByRole("button", { name: "Read question aloud" }),
        ).toBeDisabled();
    });
});
