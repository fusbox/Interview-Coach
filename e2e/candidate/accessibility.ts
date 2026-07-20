import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const wcag22LevelAATags = [
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22a",
    "wcag22aa",
];

export async function expectCandidatePageToMeetAccessibilityBaseline(
    page: Page,
    surface: string,
) {
    const result = await new AxeBuilder({ page })
        .withTags(wcag22LevelAATags)
        .analyze();

    expect(
        result.violations,
        `${surface} has WCAG 2.2 A/AA violations:\n${formatViolations(result.violations)}`,
    ).toEqual([]);
}

function formatViolations(
    violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
    return violations.map((violation) => {
        const targets = violation.nodes
            .flatMap((node) => node.target.map(String))
            .join(", ");

        return `${violation.id}: ${violation.help} (${targets})`;
    }).join("\n");
}
