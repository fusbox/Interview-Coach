import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Candidate Dashboard Coach Desk layout contract", () => {
    const dashboardCss = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    const roleTokens = readFileSync(resolve(process.cwd(), "design-system/tokens/roles.css"), "utf8");

    it("uses the focused frame and container-owned one-to-two-column composition", () => {
        expect(roleTokens).toContain("--dashboard-canvas-wide-max-width: var(--grid-focused-max);");
        expect(dashboardCss).toContain("@container candidate-coach-desk (min-width: 48rem)");
        expect(dashboardCss).not.toContain(
            "grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) minmax(0, 2fr);",
        );
    });

    it("keeps Next Round green and active-practice continuity notification-like", () => {
        expect(dashboardCss).not.toContain(".candidate-dashboard-action-tile--next-round.is-quiet");
        expect(dashboardCss).toContain(".candidate-dashboard-active-practice-notice {");
        expect(dashboardCss).toContain("background: rgb(var(--surface-raised));");
    });

    it("gives the opened Plan Dial one complete orbit-to-legend layout envelope", () => {
        expect(dashboardCss).toMatch(
            /\.candidate-plan-dial--layout-reference\s*\{[^}]*width:\s*min\(100%, 17rem\);[^}]*row-gap:\s*var\(--gap-cluster\);[^}]*padding-top:\s*var\(--gap-section\);/,
        );
        expect(dashboardCss).toMatch(
            /\.candidate-plan-dial--layout-reference \.candidate-dashboard-plan-dial\s*\{[^}]*margin:\s*0;/,
        );
        expect(dashboardCss).toMatch(
            /\.candidate-plan-dial--layout-reference \.candidate-dashboard-plan-dial__legend\s*\{[^}]*max-width:\s*100%;[^}]*margin:\s*0 auto;/,
        );
    });

    it("keeps Plan Dial structure explicit instead of inferring it from parent surfaces", () => {
        expect(dashboardCss).toContain(".candidate-plan-dial--material-plan .candidate-dashboard-plan-dial");
        expect(dashboardCss).toContain(".candidate-plan-dial--material-neutral .candidate-dashboard-plan-dial");
        expect(dashboardCss).not.toContain(".surface-plan .candidate-dashboard-plan-dial");
        expect(dashboardCss).not.toContain(".candidate-plan-dial--mounted");
    });

    it("keeps both narrow Coach Plan timelines on one node-to-connector gap contract", () => {
        expect(dashboardCss).toMatch(
            /\.candidate-coach-plan-answer-map\s*\{[^}]*--gap-workflow:\s*var\(--space-5\);[^}]*gap:\s*var\(--gap-workflow\);/,
        );
        expect(dashboardCss).toMatch(
            /\.candidate-coach-plan-answer-map \.workflow-timeline__step:not\(:last-child\) \.workflow-timeline__rail::after\s*\{[^}]*top:\s*calc\(var\(--workflow-node-size\) \+ var\(--space-1\)\);[^}]*bottom:\s*calc\(0px - var\(--gap-workflow\) \+ var\(--space-1\)\);/,
        );
        expect(dashboardCss).not.toContain(
            ".candidate-coach-plan-category-pattern__lane:not(:empty)::before",
        );
    });
});
