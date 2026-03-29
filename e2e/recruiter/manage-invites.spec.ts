import { expect, test } from "@playwright/test";

const e2eRecruiterCookie = {
    name: "e2e-auth",
    value: "recruiter",
};

test.beforeEach(async ({ context, baseURL }) => {
    const url = new URL(baseURL!);

    await context.addCookies([{
        ...e2eRecruiterCookie,
        domain: url.hostname,
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
    }]);
});

test("recruiter can search invites, open a session, and resend from the dashboard", async ({ page }) => {
    let resendRequestBody: Record<string, unknown> | null = null;

    await page.route("**/api/invite/resend", async (route) => {
        resendRequestBody = route.request().postDataJSON() as Record<string, unknown>;

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await page.goto("/recruiter");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Manage Invites" })).toBeVisible();

    const search = page.getByLabel("Search candidates or roles");
    await search.fill("Morgan");

    const matchingRow = page.getByRole("row", { name: /Morgan Candidate/i });
    await expect(matchingRow).toBeVisible();
    await expect(page.getByRole("row", { name: /Taylor Progress/i })).not.toBeVisible();

    await matchingRow.click();
    await page.waitForURL("**/recruiter/sessions/e2e-session-1");

    await expect(page.getByRole("heading", { name: "Session Details" })).toBeVisible();
    await expect(page.getByText("Tell me about a launch risk you caught before release.")).toBeVisible();

    await page.goto("/recruiter");
    await search.fill("Morgan");

    await matchingRow
        .getByRole("button", { name: /resend invite email to morgan candidate/i })
        .last()
        .click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Verify email details.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Practice Interview Invitation: Quality Engineer/i })).toBeVisible();

    await page.getByRole("button", { name: /^Send$/ }).click();

    await expect(page.getByRole("heading", { name: "Delivered!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Go to Dashboard" })).toBeVisible();

    expect(resendRequestBody).toMatchObject({
        sessionId: "e2e-session-1",
        recruiterName: "E2E Recruiter",
        recruiterTitle: "QA Recruiter",
        recruiterCompany: "E2E Talent",
        recruiterPhone: "555-0100",
        recruiterEmail: "e2e.recruiter@example.com",
    });
});
