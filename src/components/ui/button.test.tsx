import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
    Button,
    type LinkButtonProps,
} from "./button";

describe("Button", () => {
    it("renders an action as a native button with a safe default type", () => {
        render(
            <Button emphasis="primary" density="comfortable" shape="pill">
                Start practice
            </Button>,
        );

        const button = screen.getByRole("button", { name: "Start practice" });
        expect(button).toHaveAttribute("type", "button");
        expect(button).toHaveClass("ui-button", "ui-button--primary");
    });

    it("keeps its accessible name and prevents duplicate action while loading", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <Button loading onClick={onClick}>
                Save answer
            </Button>,
        );

        const button = screen.getByRole("button", { name: "Save answer" });
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("aria-busy", "true");
        expect(button).toHaveAttribute("data-state", "loading");

        await user.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    it("renders navigation as a native link", () => {
        render(
            <Button href="/candidate/dashboard" emphasis="secondary">
                Return to dashboard
            </Button>,
        );

        const link = screen.getByRole("link", { name: "Return to dashboard" });
        expect(link).toHaveAttribute("href", "/candidate/dashboard");
        expect(link).not.toHaveAttribute("role", "button");
    });
});

const disabledLink: LinkButtonProps = {
    children: "Unavailable",
    // @ts-expect-error Link buttons are navigation and cannot be disabled.
    disabled: true,
    href: "/candidate/dashboard",
};
void disabledLink;
