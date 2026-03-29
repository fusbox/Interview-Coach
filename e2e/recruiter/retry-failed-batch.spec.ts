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

test("recruiter can see a failed batch and issue a retry through the browser operator path", async ({ page }) => {
    let retryRequestHeaders: Record<string, string> | null = null;

    await page.route("**/api/recruiter/invites", async (route) => {
        await route.fulfill({
            status: 207,
            contentType: "application/json",
            body: JSON.stringify({
                batchId: "batch-failed-e2e-1",
                results: [],
                failures: [
                    {
                        firstName: "Jordan",
                        lastName: "Failure",
                        email: "jordan.failure@example.com",
                        error: "Intentional batch failure for validation",
                    },
                    {
                        firstName: "Avery",
                        lastName: "Retry",
                        email: "avery.retry@example.com",
                        error: "Intentional batch failure for validation",
                    },
                ],
                summary: {
                    requested: 2,
                    succeeded: 0,
                    failed: 2,
                    hasFailures: true,
                },
            }),
        });
    });

    await page.route("**/api/recruiter/invites/batch-failed-e2e-1/retry", async (route) => {
        retryRequestHeaders = route.request().headers();

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                batchId: "batch-retry-e2e-1",
                retriedFromBatchId: "batch-failed-e2e-1",
                results: [
                    {
                        status: "created",
                        id: "session-retry-1",
                        firstName: "Jordan",
                        lastName: "Failure",
                        email: "jordan.failure@example.com",
                        link: "http://127.0.0.1:3000/s/retry-token-1",
                    },
                    {
                        status: "created",
                        id: "session-retry-2",
                        firstName: "Avery",
                        lastName: "Retry",
                        email: "avery.retry@example.com",
                        link: "http://127.0.0.1:3000/s/retry-token-2",
                    },
                ],
                failures: [],
                summary: {
                    requested: 2,
                    succeeded: 2,
                    failed: 0,
                    hasFailures: false,
                },
            }),
        });
    });

    await page.goto("/recruiter/create");

    await page.getByLabel("Req ID").fill("REQ-E2E-RETRY-001");
    await page.getByLabel("Target Role").fill("Support Engineer");
    await page.getByLabel("STAR question 1").fill("Tell me about a time you recovered a broken workflow.");
    await page.getByRole("button", { name: /Next: Add Candidates/i }).click();

    await page.getByPlaceholder("First Name").fill("Jordan");
    await page.getByPlaceholder("Last Name").fill("Failure");
    await page.getByPlaceholder("Email Address").fill("jordan.failure@example.com");

    await page.getByRole("button", { name: /Add Candidate/i }).click();

    await page.getByPlaceholder("First Name").nth(1).fill("Avery");
    await page.getByPlaceholder("Last Name").nth(1).fill("Retry");
    await page.getByPlaceholder("Email Address").nth(1).fill("avery.retry@example.com");

    await page.getByRole("button", { name: /Next: Preview/i }).click();
    await page.getByRole("button", { name: "Preview & Send" }).click();

    await expect(
        page.getByText("No invites were created. Failed candidates: jordan.failure@example.com, avery.retry@example.com.").last()
    ).toBeVisible();
    await expect(page.getByText("0 of 2 invites were created. 2 candidates need follow-up before sending.")).toBeVisible();

    const retryResult = await page.evaluate(async () => {
        const response = await fetch("/api/recruiter/invites/batch-failed-e2e-1/retry", {
            method: "POST",
            headers: {
                "Idempotency-Key": "retry-e2e-1",
            },
        });

        return {
            status: response.status,
            body: await response.json(),
        };
    });

    expect(retryResult.status).toBe(200);
    expect(retryResult.body).toMatchObject({
        batchId: "batch-retry-e2e-1",
        retriedFromBatchId: "batch-failed-e2e-1",
        summary: {
            requested: 2,
            succeeded: 2,
            failed: 0,
            hasFailures: false,
        },
    });
    expect(retryResult.body.results).toHaveLength(2);
    expect(retryRequestHeaders?.["idempotency-key"]).toBe("retry-e2e-1");
});
