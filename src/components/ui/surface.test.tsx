import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    Surface,
    type SurfaceProps,
} from "./surface";

describe("Surface", () => {
    it("renders static prominence and state without an invented interactive role", () => {
        render(
            <Surface
                as="section"
                aria-label="Practice summary"
                prominence="feature-tint"
                state="selected"
            >
                Summary
            </Surface>,
        );

        const surface = screen.getByRole("region", {
            name: "Practice summary",
        });
        expect(surface).toHaveClass(
            "ui-surface",
            "surface-feature-tint",
        );
        expect(surface).toHaveAttribute("data-state", "selected");
        expect(surface).not.toHaveAttribute("data-interactive");
    });

    it("uses native button disabled and loading semantics for action surfaces", () => {
        render(
            <Surface as="button" state="loading">
                Open Coach Update
            </Surface>,
        );

        const surface = screen.getByRole("button", {
            name: "Open Coach Update",
        });
        expect(surface).toBeDisabled();
        expect(surface).toHaveAttribute("aria-busy", "true");
        expect(surface).toHaveAttribute("data-interactive", "true");
    });

    it("uses a native link for navigable surfaces", () => {
        render(
            <Surface as="a" href="/candidate/practice/ready">
                Review practice round
            </Surface>,
        );

        const surface = screen.getByRole("link", {
            name: "Review practice round",
        });
        expect(surface).toHaveAttribute(
            "href",
            "/candidate/practice/ready",
        );
        expect(surface).toHaveAttribute("data-interactive", "true");
    });

    it("maps reviewed coaching to the semantic quiet-Coach surface", () => {
        render(
            <Surface as="button" prominence="coach-quiet">
                Review feedback by question
            </Surface>,
        );

        expect(screen.getByRole("button", {
            name: "Review feedback by question",
        })).toHaveClass("surface-coach-quiet");
    });

    it("maps Coach Plan to its opaque semantic blue surface", () => {
        render(
            <Surface as="section" prominence="plan" aria-label="Coach plan">
                Plan progress
            </Surface>,
        );

        expect(screen.getByRole("region", { name: "Coach plan" })).toHaveClass("surface-plan");
    });
});

// @ts-expect-error Static surfaces do not accept click handlers.
const clickableStaticSurface: SurfaceProps = {
    onClick: () => undefined,
};
void clickableStaticSurface;

// @ts-expect-error Link surfaces cannot use a fake disabled state.
const disabledLinkSurface: SurfaceProps = {
    as: "a",
    children: "Unavailable",
    href: "/candidate/practice/ready",
    state: "disabled",
};
void disabledLinkSurface;
