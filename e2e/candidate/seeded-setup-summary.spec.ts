import { expect, test } from "@playwright/test";

import { expectCandidatePageToMeetAccessibilityBaseline } from "./accessibility";

const routeTransitionTimeout = 30_000;

test("seeded candidate completes the candidate-led V2 practice loop", async ({ page }) => {
    test.setTimeout(240_000);
    const role = `Milestone Validation Specialist ${Date.now()}`;
    const answers = [
        "I review the work requirements, identify the most important outcome, and connect my experience to that need.",
        "I handled a similar priority by checking the facts, coordinating with the people involved, and confirming the result.",
        "I work best where expectations are clear, teammates communicate directly, and everyone follows through on commitments.",
    ];
    await page.goto("/candidate/dev/launch?candidate=alternate&next=/candidate/setup");
    await expect(page).toHaveURL(/\/candidate\/setup$/i, { timeout: routeTransitionTimeout });
    await expect(page.getByRole("heading", { name: "Practice Setup" })).toBeVisible();
    await expectCandidatePageToMeetAccessibilityBaseline(page, "candidate setup");

    await page.getByLabel("Target role *").fill(role);
    await page.getByLabel("Job description *").fill(
        "Review quality records, communicate findings, resolve discrepancies, and document reliable outcomes.",
    );
    await page.getByRole("button", { name: /^Screening call/i }).click();
    await page.getByRole("button", { name: "3", exact: true }).click();
    await page.getByRole("button", { name: "Start practice" }).click();

    await expect(page).toHaveURL(/\/candidate\/session\/[0-9a-f-]+$/i, { timeout: routeTransitionTimeout });
    await expect(page.getByRole("heading", { name: "Your practice is ready." })).toBeVisible();
    await expect(page.getByRole("heading", { name: role })).toBeVisible();
    await expectCandidatePageToMeetAccessibilityBaseline(page, "candidate practice landing");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Start practice" }).click();

    await expect(page.getByRole("heading", { name: "Entering practice space" })).toBeVisible();

    for (let index = 0; index < answers.length; index += 1) {
        await expect(page.getByText(`Question ${index + 1} of ${answers.length}`, { exact: true })).toBeVisible({
            timeout: routeTransitionTimeout,
        });
        if (index === 0) {
            await expectCandidatePageToMeetAccessibilityBaseline(page, "candidate live-practice question");
            const draftSaved = page.waitForResponse((response) => (
                response.request().method() === "PUT"
                && response.url().endsWith("/answer-drafts")
                && response.ok()
            ));
            await page.getByRole("textbox", { name: "Type your answer" }).fill(answers[index]);
            await draftSaved;
            const sessionUrl = page.url();
            await page.reload();
            await expect(page.getByRole("textbox", { name: "Type your answer" })).toHaveValue(answers[index]);

            const recoveredPage = await page.context().newPage();
            await recoveredPage.goto(sessionUrl);
            await expect(recoveredPage.getByRole("textbox", { name: "Type your answer" })).toHaveValue(answers[index]);
            await recoveredPage.close();
        } else {
            await page.getByRole("textbox", { name: "Type your answer" }).fill(answers[index]);
        }
        await page.getByRole("button", { name: "Submit answer" }).click();
        await expect(page.getByRole("heading", { name: "First, here is what I heard." })).toBeVisible({
            timeout: routeTransitionTimeout,
        });

        await page.getByRole("button", {
            name: index === answers.length - 1
                ? "Skip and finish session"
                : "Skip and continue to next question",
        }).click();
    }

    await expect(page).toHaveURL(/\/candidate\/dashboard\?prep=[0-9a-f-]+$/i, {
        timeout: routeTransitionTimeout,
    });
    await expect(page.getByText(role, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Coach Update" })).toBeVisible({
        timeout: routeTransitionTimeout,
    });
    await expectCandidatePageToMeetAccessibilityBaseline(page, "candidate dashboard");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Open Coach Update" }).click();
    await expect(page.getByRole("dialog", { name: "Let's review your latest practice." })).toBeVisible();
    await page.getByRole("button", { name: answers[0] }).click();
    await expect(page.getByText("Evidence in your answer")).toBeVisible();
    await expectCandidatePageToMeetAccessibilityBaseline(page, "candidate Coach Update dialog");
});

test("candidate can finish when immediate coaching is unavailable", async ({ page }) => {
    test.setTimeout(240_000);
    const role = `Provider Continuation Specialist ${Date.now()}`;

    await page.route("**/answers/*/analysis", async (route) => {
        await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
                status: "answer_analysis_unavailable",
                retryable: false,
            }),
        });
    });

    await page.goto("/candidate/dev/launch?candidate=alternate&next=/candidate/setup");
    await expect(page).toHaveURL(/\/candidate\/setup$/i, { timeout: routeTransitionTimeout });
    await page.getByLabel("Target role *").fill(role);
    await page.getByLabel("Job description *").fill(
        "Review operational work, document findings, communicate clearly, and follow through on next steps.",
    );
    await page.getByRole("button", { name: /^Screening call/i }).click();
    await page.getByRole("button", { name: "3", exact: true }).click();
    await page.getByRole("button", { name: "Start practice" }).click();

    await expect(page).toHaveURL(/\/candidate\/session\/[0-9a-f-]+$/i, { timeout: routeTransitionTimeout });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Start practice" }).click();

    for (let index = 0; index < 3; index += 1) {
        await expect(page.getByText(`Question ${index + 1} of 3`, { exact: true })).toBeVisible({
            timeout: routeTransitionTimeout,
        });
        await page.getByRole("textbox", { name: "Type your answer" }).fill(
            `I would clarify the requirement, take the relevant action, and document the result for question ${index + 1}.`,
        );
        await page.getByRole("button", { name: "Submit answer" }).click();
        await expect(page.getByText("Your answer is saved. Coaching isn't available for this answer, but you can keep going.")).toBeVisible({
            timeout: routeTransitionTimeout,
        });
        await page.getByRole("button", {
            name: index === 2 ? "Finish without coaching" : "Continue without coaching",
        }).click();
    }

    await expect(page).toHaveURL(/\/candidate\/dashboard\?prep=[0-9a-f-]+$/i, {
        timeout: routeTransitionTimeout,
    });
    await expect(page.getByText(role, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your practice is saved." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try Coach Update again" })).toBeVisible();
    await expectCandidatePageToMeetAccessibilityBaseline(page, "candidate unavailable-coaching dashboard");
});

test("resume review recovers across browsers, propagates by reference, and clears after setup consumption", async ({
    browser,
    page,
}) => {
    test.setTimeout(180_000);
    const role = `Resume Milestone Specialist ${Date.now()}`;
    const rawResume = [
        "Dev Candidate Alternate",
        "candidate-dev-alt@talentarbor.local | 312-555-0144",
        "123 Main Street, Chicago, IL 60601",
        "Inventory Coordinator | Example Distribution | 2022-2026",
        "Reviewed shipment records, resolved discrepancies, and documented accurate outcomes.",
    ].join("\n");

    await page.goto("/candidate/dev/launch?candidate=alternate&next=/candidate/setup");
    await expect(page).toHaveURL(/\/candidate\/setup$/i, { timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: "Paste text" }).click();
    await page.getByLabel("Paste resume text").fill(rawResume);
    await page.getByRole("button", { name: "Review resume" }).click();

    await expect(page.getByText("Review prepared text", { exact: true })).toBeVisible({
        timeout: routeTransitionTimeout,
    });
    const preparedResume = page.getByLabel("Paste resume text");
    const processedText = await preparedResume.inputValue();
    expect(processedText).toContain("Inventory Coordinator");
    expect(processedText).not.toContain("Dev Candidate Alternate");
    expect(processedText).not.toContain("candidate-dev-alt@talentarbor.local");
    expect(processedText).not.toContain("312-555-0144");
    expect(processedText).not.toContain("123 Main Street");
    await expectCandidatePageToMeetAccessibilityBaseline(page, "candidate resume review");

    await page.reload();
    await expect(page.getByLabel("Paste resume text")).toHaveValue(processedText);

    const recoveredContext = await browser.newContext({
        baseURL: process.env.PLAYWRIGHT_BASE_URL,
        viewport: { width: 390, height: 844 },
    });
    try {
        const recoveredPage = await recoveredContext.newPage();
        await recoveredPage.goto("/candidate/dev/launch?candidate=alternate&next=/candidate/setup");
        await expect(recoveredPage).toHaveURL(/\/candidate\/setup$/i, { timeout: routeTransitionTimeout });
        await expect(recoveredPage.getByLabel("Paste resume text")).toHaveValue(processedText);
        await expect(recoveredPage.getByText("Review prepared text", { exact: true })).toBeVisible();
        await expectCandidatePageToMeetAccessibilityBaseline(recoveredPage, "candidate resume review mobile recovery");
    } finally {
        await recoveredContext.close();
    }

    await page.getByRole("button", { name: "Use this resume" }).click();
    await expect(page.getByText("Resume ready", { exact: true })).toBeVisible();
    await page.getByLabel("Target role *").fill(role);
    await page.getByLabel("Job description *").fill(
        "Review inventory records, investigate discrepancies, communicate findings, and document reliable outcomes.",
    );
    await page.getByRole("button", { name: /^Screening call/i }).click();
    await page.getByRole("button", { name: "3", exact: true }).click();
    await page.getByRole("button", { name: "Start practice" }).click();

    await expect(page).toHaveURL(/\/candidate\/session\/[0-9a-f-]+$/i, { timeout: routeTransitionTimeout });
    await expect(page.getByRole("heading", { name: role })).toBeVisible();
    await expect(page.getByText("Pasted resume", { exact: true })).toBeVisible();

    await page.goto("/candidate/setup");
    await expect(page.getByLabel("Paste resume text")).toHaveValue("");
    await expect(page.getByText("Prepare resume text", { exact: true })).toBeVisible();
});
