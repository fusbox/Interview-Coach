import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("reserves the text composer footer only once", () => {
    const styles = readFileSync(
        join(process.cwd(), "src", "features", "interview-session-v2", "SharedLivePracticeShell.module.css"),
        "utf8",
    );
    const fieldRule = styles.match(/\.field\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(fieldRule).toContain("margin-bottom: var(--space-4);");
    expect(fieldRule).not.toContain("var(--button-height)");
});
