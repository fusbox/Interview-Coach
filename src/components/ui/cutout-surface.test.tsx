import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    CutoutSurface,
    DEFAULT_CUTOUT_GEOMETRY,
    createCutoutPath,
    getCutoutTransform,
} from "./cutout-surface";

describe("CutoutSurface", () => {
    it("matches the tokenized 92 by 44 notch and established surface radii", () => {
        const roles = readFileSync(
            join(process.cwd(), "design-system", "tokens", "roles.css"),
            "utf8",
        );

        expect(roles).toContain("--cutout-notch-width: 5.75rem; /* 92px */");
        expect(roles).toContain(
            "--cutout-notch-depth: var(--button-height); /* 44px */",
        );
        expect(roles).toContain(
            "--cutout-notch-radius: var(--radius-widget); /* 16px */",
        );
        expect(roles).toContain(
            "--cutout-surface-radius: var(--radius-card); /* 24px */",
        );
        expect(roles).toContain("--cutout-control-offset: calc(");
        expect(createCutoutPath(DEFAULT_CUTOUT_GEOMETRY)).toBe(
            "M 24 0 L 212 0 A 16 16 0 0 1 228 16 L 228 28 A 16 16 0 0 0 244 44 L 296 44 A 24 24 0 0 1 320 68 L 320 216 A 24 24 0 0 1 296 240 L 24 240 A 24 24 0 0 1 0 216 L 0 24 A 24 24 0 0 1 24 0 Z",
        );
    });

    it("renders a responsive SVG and an accessible top-end notch group", () => {
        const { container } = render(
            <CutoutSurface
                notch={<button type="button">Hints</button>}
                notchLabel="Question help"
            >
                <h2>Question</h2>
            </CutoutSurface>,
        );

        expect(screen.getByRole("heading", { name: "Question" })).toBeVisible();
        expect(
            screen.getByRole("group", { name: "Question help" }),
        ).toContainElement(screen.getByRole("button", { name: "Hints" }));
        expect(container.firstElementChild).toHaveAttribute(
            "data-cutout",
            "top-end",
        );
        expect(container.querySelector("svg")).toHaveAttribute(
            "preserveAspectRatio",
            "none",
        );
        expect(container.querySelector(".ui-cutout-surface__recess"))
            .toBeInTheDocument();
        expect(container.querySelector(".ui-cutout-surface__contour"))
            .toBeInTheDocument();
        expect(container.querySelector("path")).toHaveAttribute("d");
        expect(
            screen.getByRole("group", { name: "Question help" }),
        ).toHaveStyle({ top: "var(--cutout-control-offset)" });
    });

    it("supports bottom-start and logical RTL transforms", () => {
        expect(getCutoutTransform("top-end", "ltr", 320, 240)).toBeUndefined();
        expect(getCutoutTransform("top-end", "rtl", 320, 240)).toBe(
            "translate(320 0) scale(-1 1)",
        );
        expect(getCutoutTransform("bottom-start", "ltr", 320, 240)).toBe(
            "translate(320 240) rotate(180)",
        );
        expect(getCutoutTransform("bottom-start", "rtl", 320, 240)).toBe(
            "translate(0 240) scale(1 -1)",
        );
    });

    it("scales geometry down instead of producing negative segments", () => {
        const path = createCutoutPath({
            ...DEFAULT_CUTOUT_GEOMETRY,
            height: 60,
            width: 100,
        });

        expect(path).not.toContain("-");
        expect(path).not.toContain("NaN");
    });
});
