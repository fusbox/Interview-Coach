import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tokenDirectory = join(process.cwd(), "design-system", "tokens");
const canonicalImports = [
    "tokens/fonts.css",
    "tokens/colors.css",
    "tokens/typography.css",
    "tokens/shape.css",
    "tokens/elevation.css",
    "tokens/motion.css",
    "tokens/roles.css",
    "tokens/spacing.css",
    "tokens/layout.css",
    "tokens/accessibility.css",
    "tokens/utilities.css",
    "tokens/legacy-compat.css",
];

function collectSourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(path);
        return /\.(css|ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    });
}

describe("global design-system foundation", () => {
    it("loads the canonical token files in order", () => {
        const styles = readFileSync(join(process.cwd(), "design-system", "styles.css"), "utf8");
        const imports = styles
            .split(/\r?\n/)
            .map((line) => line.match(/^@import "([^"]+)";$/)?.[1])
            .filter((value): value is string => Boolean(value));

        expect(imports).toEqual(canonicalImports);
    });

    it("uses one global namespace and one runtime color language", () => {
        const tokenCss = readdirSync(tokenDirectory)
            .filter((file) => file.endsWith(".css"))
            .map((file) => readFileSync(join(tokenDirectory, file), "utf8"))
            .join("\n");
        const tailwind = readFileSync(join(process.cwd(), "tailwind.config.ts"), "utf8");

        expect(tokenCss).not.toMatch(/--candidate-|\.candidate-design-system/);
        expect(tokenCss).not.toMatch(/\bhsl\(|\boklch\(|\brgba\(|#[0-9a-f]{3,8}\b/i);
        expect(tailwind).not.toMatch(/--candidate-|\bhsl\(|\boklch\(/);
        expect(tailwind).toContain("rgb(var(--primary) / <alpha-value>)");
    });

    it("does not reintroduce the retired candidate wrapper in application source", () => {
        const source = collectSourceFiles(join(process.cwd(), "src"))
            .map((file) => readFileSync(file, "utf8"))
            .join("\n");

        expect(source).not.toContain("candidate-design-system");
    });

    it("keeps the blue-only Quiet Runway canvas scoped to the candidate dashboard", () => {
        const roles = readFileSync(join(tokenDirectory, "roles.css"), "utf8");
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
        const canvasContract = roles.match(
            /--dashboard-canvas-runway-edge:[\s\S]*?--dashboard-glass-raised-background:/,
        )?.[0];

        expect(roles).toContain("--dashboard-canvas-background:");
        expect(roles).toContain("--dashboard-canvas-runway-edge:");
        expect(roles).toContain("--dashboard-canvas-runway-center:");
        expect(canvasContract).toContain("linear-gradient(");
        expect(canvasContract).toContain("90deg");
        expect(canvasContract).toContain("180deg");
        expect(canvasContract).not.toContain("radial-gradient(");
        expect(roles).not.toContain("--dashboard-canvas-field-");
        expect(applicationStyles).toMatch(
            /\.candidate-dashboard-page\s*\{[\s\S]*?background:\s*var\(--dashboard-canvas-background\);/,
        );
    });

    it("keeps long dashboard question copy on predictable greedy wrapping", () => {
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
        const questionReference = applicationStyles.match(
            /\.candidate-dashboard-question-reference\s*>\s*p\s*\{([^}]*)\}/,
        )?.[1];

        expect(questionReference).toContain("max-width: none;");
        expect(questionReference).toContain("text-wrap: wrap;");
        expect(questionReference).not.toContain("text-wrap: pretty;");
    });

    it("keeps dashboard action-tile direction cues bare and graphical marks the same size", () => {
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
        const direction = applicationStyles.match(
            /^\.candidate-dashboard-action-tile__direction\s*\{([^}]*)\}/m,
        )?.[1];
        const mark = applicationStyles.match(
            /^\.candidate-dashboard-action-tile__mark\s*\{([^}]*)\}/m,
        )?.[1];
        const countMark = applicationStyles.match(
            /^\.candidate-dashboard-action-tile__mark--count\s*\{([^}]*)\}/m,
        )?.[1];

        expect(direction).toContain("background: transparent;");
        expect(direction).toContain("box-shadow: none;");
        expect(mark).toContain("width: 3.5rem;");
        expect(mark).toContain("height: 3.5rem;");
        expect(countMark).not.toMatch(/(?:^|\n)\s*(?:width|height):/);
    });

    it("keeps the dashboard fallback neutral and normally wrapped", () => {
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
        const emptyState = applicationStyles.match(
            /^\.candidate-dashboard-empty\s*\{([^}]*)\}/m,
        )?.[1];
        const emptyStateBody = applicationStyles.match(
            /^\.candidate-dashboard-empty\s*>\s*p\s*\{([^}]*)\}/m,
        )?.[1];

        expect(emptyState).not.toContain("border-left:");
        expect(emptyState).not.toContain("--primary-wash");
        expect(emptyStateBody).toContain("text-wrap: wrap;");
        expect(emptyStateBody).not.toContain("text-wrap: pretty;");
    });

    it("keeps the session microphone mounted with a semantic inset contour", () => {
        const voiceStyles = readFileSync(
            join(
                process.cwd(),
                "src",
                "features",
                "interview-session-v2",
                "SessionVoiceAnswerCapture.module.css",
            ),
            "utf8",
        );
        const recordControl = voiceStyles.match(/^\.recordControl\s*\{([^}]*)\}/m)?.[1];

        expect(recordControl).toContain("--record-control-contour-light:");
        expect(recordControl).toContain("--record-control-contour-shade:");
        expect(recordControl).toMatch(/box-shadow:\s*[\s\S]*?inset[\s\S]*?var\(--record-control-elevation\);/);
    });

    it("keeps dynamic candidate task copy on predictable greedy wrapping", () => {
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
        const liveSessionStyles = readFileSync(
            join(process.cwd(), "src", "features", "interview-session-v2", "SharedLivePracticeShell.module.css"),
            "utf8",
        );
        const assistanceStyles = readFileSync(
            join(process.cwd(), "src", "features", "interview-session-v2", "QuestionAssistanceDisclosure.module.css"),
            "utf8",
        );
        const preSessionStyles = readFileSync(
            join(process.cwd(), "src", "features", "candidate-session-v2", "CandidatePreSessionLanding.module.css"),
            "utf8",
        );

        expect(applicationStyles).toMatch(
            /\.candidate-dashboard-stage\s*>\s*p\s*\{[^}]*text-wrap:\s*wrap;/,
        );
        expect(applicationStyles).toMatch(
            /\.candidate-dashboard-empty\s*>\s*p\s*\{[^}]*text-wrap:\s*wrap;/,
        );
        expect(applicationStyles).toMatch(
            /\.candidate-answer-review__message\s*\{[^}]*text-wrap:\s*wrap;/,
        );
        expect(applicationStyles).toMatch(
            /\.candidate-coach-plan-question-panel\s*>\s*header h3,[^}]*text-wrap:\s*wrap;/,
        );
        expect(liveSessionStyles).toMatch(/\.question h1\s*\{[^}]*text-wrap:\s*wrap;/);
        expect(assistanceStyles).toMatch(/\.guidance p,[^}]*text-wrap:\s*wrap;/);
        expect(preSessionStyles).toMatch(/\.statusCopy\s*\{[^}]*text-wrap:\s*wrap;/);
        expect(preSessionStyles).toMatch(/\.questionText\s*\{[^}]*text-wrap:\s*wrap;/);
        expect(preSessionStyles).toMatch(/\.reassurance p\s*\{[^}]*text-wrap:\s*wrap;/);
    });

    it("keeps spotlight actions white with primary-blue content after application overrides", () => {
        const utilities = readFileSync(join(tokenDirectory, "utilities.css"), "utf8");
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

        expect(utilities).toMatch(
            /\.on-color-action\s*\{[\s\S]*?background:\s*rgb\(var\(--solid-foreground\)\);[\s\S]*?color:\s*rgb\(var\(--primary-solid\)\);/,
        );
        expect(applicationStyles).toContain(".candidate-dashboard-stage__primary:not(.on-color-action)");
    });

    it("keeps reviewed Coach Update history on an opaque semantic blue docket", () => {
        const roles = readFileSync(join(tokenDirectory, "roles.css"), "utf8");
        const utilities = readFileSync(join(tokenDirectory, "utilities.css"), "utf8");

        expect(roles).toContain("--coach-update-quiet-background:");
        expect(roles).toContain("--coach-update-quiet-foreground:");
        const quietCoachSurface = utilities.match(
            /\.surface-coach-quiet\s*\{([^}]*)\}/,
        )?.[1];
        expect(quietCoachSurface).toContain("background: var(--coach-update-quiet-background);");
        expect(quietCoachSurface).toContain("color: var(--coach-update-quiet-foreground);");
        expect(quietCoachSurface).not.toContain("backdrop-filter");
    });

    it("distinguishes the assembled Next Round queue from the available plan inventory", () => {
        const roles = readFileSync(join(tokenDirectory, "roles.css"), "utf8");
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

        expect(roles).toContain("--next-round-builder-workspace-background:");
        expect(roles).toContain("--next-round-builder-queue-background:");
        expect(roles).toContain("--next-round-builder-queue-item-background:");
        expect(roles).toContain("--next-round-builder-add-background:");
        expect(roles).toContain("--next-round-builder-add-foreground:");
        expect(applicationStyles).toMatch(
            /\.candidate-next-round-list\s*\{[\s\S]*?background:\s*var\(--next-round-builder-queue-background\);/,
        );
        expect(applicationStyles).toMatch(
            /\.candidate-next-round-choices\s*\{[\s\S]*?background:\s*rgb\(var\(--surface-raised\)\);[\s\S]*?box-shadow:\s*var\(--elevation-card\);/,
        );
        expect(applicationStyles).toMatch(
            /\.candidate-next-round-dialog__footer\s*\{[\s\S]*?box-shadow:\s*var\(--elevation-panel\);/,
        );
        expect(applicationStyles).toMatch(
            /@media \(max-width: 719px\)[\s\S]*?\.candidate-next-round-choices > li > button\s*\{[\s\S]*?width:\s*var\(--button-height\);[\s\S]*?border-radius:\s*50%;/,
        );
    });

    it("shares the mounted Plan wheel while separating dashboard and opened-surface materials", () => {
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
        const roles = readFileSync(join(tokenDirectory, "roles.css"), "utf8");
        const utilities = readFileSync(join(tokenDirectory, "utilities.css"), "utf8");
        const dashboardExperience = readFileSync(
            join(process.cwd(), "src", "features", "candidate-dashboard-v2", "CandidateDashboardCoachDeskExperience.tsx"),
            "utf8",
        );

        expect(roles).toContain("--coach-plan-surface-background:");
        expect(roles).toContain("--coach-plan-wheel-plate-start:");
        expect(roles).toContain("--coach-plan-wheel-well-end:");
        expect(roles).toContain("--coach-plan-wheel-well-highlight:");
        expect(roles).toContain("--coach-plan-wheel-well-rim:");
        expect(roles).toContain("--coach-plan-wheel-well-contour:");
        expect(roles).toContain("--coach-plan-wheel-strong-ink:");
        expect(roles).not.toContain("--coach-plan-wheel-background:");
        expect(roles).not.toContain("--coach-plan-wheel-center:");
        expect(utilities).toContain(".surface-plan {");
        expect(applicationStyles).toContain("var(--coach-plan-wheel-plate-start)");
        expect(applicationStyles).toContain("var(--coach-plan-wheel-well-end)");
        expect(applicationStyles).toContain("color: var(--coach-plan-wheel-ink);");
        expect(applicationStyles).toContain(".candidate-plan-dial--material-plan .candidate-dashboard-plan-dial__legend,");
        expect(applicationStyles).toContain(".candidate-plan-dial--material-neutral .candidate-dashboard-plan-dial__legend {");
        expect(applicationStyles).toContain("background: rgb(var(--surface-base) / 0.72);");
        expect(applicationStyles).not.toContain("radial-gradient(circle at 16% 0");
        expect(applicationStyles).toContain("background: rgb(var(--surface-raised));");
        expect(applicationStyles).toContain("0 0 0 var(--space-2) rgb(var(--primary))");
        expect(applicationStyles).toContain("background: rgb(var(--primary-solid));");
        expect(applicationStyles).toContain("background: var(--coach-plan-surface-background);");
        expect(applicationStyles).toContain("var(--coach-plan-wheel-well-start)");
        expect(applicationStyles).toContain("var(--coach-plan-wheel-well-highlight)");
        expect(applicationStyles).toContain("var(--coach-plan-wheel-well-rim)");
        expect(applicationStyles).toContain("var(--coach-plan-wheel-well-contour)");
        expect(dashboardExperience.match(/function CandidateDashboardPlanProgress/g)).toHaveLength(1);
        expect(dashboardExperience.match(/<CandidateDashboardPlanProgress/g)?.length ?? 0)
            .toBeGreaterThanOrEqual(2);
        expect(dashboardExperience).toContain('prominence="plan"');
        expect(dashboardExperience).not.toContain("CandidateDashboardPlanPulse");
        expect(applicationStyles).not.toContain("candidate-dashboard-plan-pulse");
    });
});
