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

test("recruiter can create, preview, and send an invite batch", async ({ page }) => {
    await page.route("**/api/recruiter/invites", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                batchId: "batch-e2e-1",
                results: [{
                    status: "created",
                    id: "session-e2e-1",
                    firstName: "Taylor",
                    lastName: "Candidate",
                    email: "taylor.candidate@example.com",
                    link: "http://127.0.0.1:3000/s/e2e-token",
                }],
                failures: [],
                summary: {
                    requested: 1,
                    succeeded: 1,
                    failed: 0,
                    hasFailures: false,
                },
            }),
        });
    });

    await page.route("**/api/invite/send", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true }),
        });
    });

    await page.goto("/recruiter/create");

    await expect(page.getByRole("heading", { name: "Job Details & Questions" })).toBeVisible();

    await page.getByLabel("Req ID").fill("REQ-E2E-001");
    await page.getByLabel("Target Role").fill("Quality Engineer");
    await page.getByLabel("STAR question 1").fill("Tell me about a bug you found before launch.");

    await page.getByRole("button", { name: /Next: Add Candidates/i }).click();

    await expect(page.getByRole("heading", { name: "Add Candidates" })).toBeVisible();

    await page.getByPlaceholder("First Name").fill("Taylor");
    await page.getByPlaceholder("Last Name").fill("Candidate");
    await page.getByPlaceholder("Email Address").fill("taylor.candidate@example.com");

    await page.getByRole("button", { name: /Next: Preview/i }).click();

    await expect(page.getByRole("heading", { name: "Confirm Details & Invite" })).toBeVisible();
    await expect(page.getByText("taylor.candidate@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Preview & Send" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Verify email details.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Practice Interview Invitation: Quality Engineer/i })).toBeVisible();

    await page.getByRole("button", { name: /^Send$/ }).click();

    await expect(page.getByRole("heading", { name: "Delivered!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start New Invite" })).toBeVisible();
});
