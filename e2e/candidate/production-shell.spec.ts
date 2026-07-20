import { expect, test } from "@playwright/test";

import { expectCandidatePageToMeetAccessibilityBaseline } from "./accessibility";

const localProductionBudgets = {
    domContentLoadedMs: 5_000,
    loadMs: 7_500,
    resourceCount: 100,
    transferredBytes: 2_500_000,
} as const;

test("production public shell is accessible, responsive, and within local budgets", async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
        failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`);
    });

    const response = await page.goto("/", { waitUntil: "load" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Interview Coach" })).toBeVisible();
    await expectCandidatePageToMeetAccessibilityBaseline(page, "production public landing");

    const metrics = await readProductionMetrics(page);
    await test.info().attach("production-public-shell-metrics", {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
    });

    expect(metrics.domContentLoadedMs).toBeLessThanOrEqual(localProductionBudgets.domContentLoadedMs);
    expect(metrics.loadMs).toBeLessThanOrEqual(localProductionBudgets.loadMs);
    expect(metrics.resourceCount).toBeLessThanOrEqual(localProductionBudgets.resourceCount);
    expect(metrics.transferredBytes).toBeLessThanOrEqual(localProductionBudgets.transferredBytes);
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "load" });
    await expectCandidatePageToMeetAccessibilityBaseline(page, "production public landing mobile");
    expect(await hasHorizontalOverflow(page)).toBe(false);
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
});

test("production fails closed for development-only candidate routes", async ({ request }) => {
    const developmentOnlyRoutes = [
        "/candidate/dev/launch?candidate=primary&next=/candidate/setup",
        "/candidate/dashboard-demo",
        "/candidate/session-demo",
        "/candidate/settings-demo",
    ];

    for (const route of developmentOnlyRoutes) {
        const response = await request.get(route, { maxRedirects: 0 });
        expect(response.status(), `${route} must not be available in production`).toBe(404);
    }
});

async function readProductionMetrics(page: import("@playwright/test").Page) {
    return page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

        return {
            domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
            loadMs: Math.round(navigation?.loadEventEnd ?? 0),
            resourceCount: resources.length,
            transferredBytes: resources.reduce((total, resource) => total + resource.transferSize, 0),
        };
    });
}

async function hasHorizontalOverflow(page: import("@playwright/test").Page) {
    return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}
