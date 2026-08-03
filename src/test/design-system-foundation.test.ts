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

    it("keeps the responsive blue canvas scoped to the candidate dashboard", () => {
        const roles = readFileSync(join(tokenDirectory, "roles.css"), "utf8");
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

        expect(roles).toContain("--dashboard-canvas-background:");
        expect(roles).toContain("--dashboard-canvas-field-inline-offset: min(64vw, 17.2rem);");
        expect(roles).toContain("--dashboard-canvas-field-leading-width: min(144vw, 38.7rem);");
        expect(roles).toContain("--dashboard-canvas-field-trailing-width: min(136vw, 36.55rem);");
        expect(applicationStyles).toMatch(
            /\.candidate-dashboard-page\s*\{[\s\S]*?background:\s*var\(--dashboard-canvas-background\);/,
        );
    });

    it("keeps spotlight actions white with primary-blue content after application overrides", () => {
        const utilities = readFileSync(join(tokenDirectory, "utilities.css"), "utf8");
        const applicationStyles = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

        expect(utilities).toMatch(
            /\.on-color-action\s*\{[\s\S]*?background:\s*rgb\(var\(--solid-foreground\)\);[\s\S]*?color:\s*rgb\(var\(--primary-solid\)\);/,
        );
        expect(applicationStyles).toContain(".candidate-dashboard-stage__primary:not(.on-color-action)");
    });
});
