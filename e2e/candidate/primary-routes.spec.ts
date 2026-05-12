import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const e2eRecruiterCookie = {
    name: "e2e-auth",
    value: "recruiter",
};

async function addRecruiterCookie(context: BrowserContext, baseURL: string | undefined) {
    const url = new URL(baseURL!);

    await context.addCookies([{
        ...e2eRecruiterCookie,
        domain: url.hostname,
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
    }]);
}

async function expectAccessibilityBaseline(page: Page) {
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);

    const unnamedControls = await page.locator("button, a[href], input, textarea, select").evaluateAll((controls) => (
        controls
            .filter((control) => {
                const text = control.textContent?.trim() ?? "";
                const ariaLabel = control.getAttribute("aria-label")?.trim() ?? "";
                const labelledBy = control.getAttribute("aria-labelledby")?.trim() ?? "";
                const title = control.getAttribute("title")?.trim() ?? "";

                if (text || ariaLabel || labelledBy || title) {
                    return false;
                }

                if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
                    return (control.labels?.length ?? 0) === 0;
                }

                return true;
            })
            .map((control) => control.outerHTML)
    ));

    expect(unnamedControls).toEqual([]);
}

test("public candidate landing route renders accessible CTA targets", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /interview practice that gets you in quickly/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start practicing/i }).first()).toHaveAttribute(
        "href",
        "/auth/talentarbor/start?next=/practice"
    );
    await expect(page.getByRole("link", { name: /review dashboard/i }).first()).toHaveAttribute(
        "href",
        "/auth/talentarbor/start?next=/dashboard"
    );
    await expectAccessibilityBaseline(page);
});

test("candidate protected routes redirect through TalentArbor login intent", async ({ request }) => {
    for (const route of ["/practice", "/dashboard", "/session/session-1", "/summary/session-1"]) {
        const response = await request.get(route, { maxRedirects: 0 });

        expect(response.status(), route).toBe(307);
        expect(response.headers()["location"], route).toBe(`/auth/talentarbor/start?next=${encodeURIComponent(route)}`);
    }
});

test("recruiter shared-host alias lands on create page for authenticated recruiter", async ({ page, context, baseURL }) => {
    await addRecruiterCookie(context, baseURL);

    await page.goto("/recruiter");

    await expect(page).toHaveURL(/\/recruiter\/create$/);
    await expect(page.getByLabel("Target Role")).toBeVisible();
});

test("admin and qa routes remain protected under shared host", async ({ request }) => {
    for (const route of ["/admin/feedback", "/qa/ai-quality"]) {
        const response = await request.get(route, { maxRedirects: 0 });

        expect(response.status(), route).toBe(307);
        expect(response.headers()["location"], route).toBe(`/login?next=${encodeURIComponent(route)}`);
    }
});
