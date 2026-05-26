import { expect, test } from "@playwright/test";

const routeTransitionTimeout = 30_000;

test("seeded candidate can move from practice setup to session summary", async ({ page }) => {
    test.setTimeout(180_000);
    let ttsRequestCount = 0;
    await page.route("**/api/tts", async (route) => {
        ttsRequestCount += 1;
        expect(route.request().headers()["x-session-id"]).toBeTruthy();
        await route.fulfill({
            status: 200,
            contentType: "audio/wav",
            body: createSilentWavBuffer(),
        });
    });

    await page.goto("/practice");

    await expect(page.getByRole("heading", { name: /practice setup/i })).toBeVisible();
    await page.getByLabel(/target role/i).fill("Customer Success Manager");
    await page.getByLabel(/job description/i).fill("Customer success leader with SaaS onboarding and renewal experience.");
    await page.getByLabel(/question count/i).selectOption("3");
    await page.getByLabel(/I understand Interview Coach uses AI/i).check();

    await Promise.all([
        page.waitForURL(/\/session\/[0-9a-f-]+$/i, { timeout: routeTransitionTimeout, waitUntil: "commit" }),
        page.getByRole("button", { name: /start generating questions/i }).click({ noWaitAfter: true }),
    ]);
    await expect(page.getByRole("heading", { name: /ready for your interview/i })).toBeVisible();
    await expect(page.getByText(/Customer Success Manager/i)).toBeVisible();

    await page.getByRole("button", { name: /^begin first question$/i }).click();
    await expect(page.getByRole("button", { name: /record answer/i })).toBeVisible();

    const readQuestionButton = page.getByRole("button", { name: /read question/i });
    if (await readQuestionButton.isVisible()) {
        await readQuestionButton.click();
    }
    await expect(page.getByRole("button", { name: /stop reading/i })).toBeVisible();
    expect(ttsRequestCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: /text mode/i }).click();
    await page.getByLabel(/type your answer/i).fill(
        "I listen first, name the conflict clearly, and propose a next step that keeps the customer experience moving.",
    );
    await page.getByRole("button", { name: /submit answer/i }).click();

    await expect(page.getByText(/reviewing answer content/i)).toBeVisible();
    await continueFromFeedback(page, false, { verifyTranscript: /I listen first/i });

    await expect(page.getByText(/Question 2 of 3/i)).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: /text mode/i }).click();
    await page.getByLabel(/type your answer/i).fill(
        "I separate urgency from impact, name the tradeoff, and make the decision criteria visible before recommending a path.",
    );
    await page.getByRole("button", { name: /submit answer/i }).click();
    await expect(page.getByText(/I separate urgency from impact/i)).toBeVisible();
    await skipFromFeedback(page, false);

    await expect(page.getByText(/Question 3 of 3/i)).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: /text mode/i }).click();
    await page.getByLabel(/type your answer/i).fill(
        "I start with the customer problem, validate the workflow with users, and then turn the evidence into a small testable plan.",
    );
    await page.getByRole("button", { name: /submit answer/i }).click();
    await expect(page.getByText(/I start with the customer problem/i)).toBeVisible();
    await skipFromFeedback(page, true);

    await expect(page).toHaveURL(/\/summary\/[0-9a-f-]+$/i, { timeout: routeTransitionTimeout });
    await expect(page.getByText(/one moment while i create your feedback summary/i)).toBeVisible({ timeout: routeTransitionTimeout });

    const sessionUrl = page.url();
    const sessionId = sessionUrl.split("/summary/")[1]?.split(/[?#]/)[0];
    expect(sessionId).toBeTruthy();

    await expect(page.getByRole("heading", { name: /great practice round, dev/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /session debrief|executive summary/i })).toBeVisible({ timeout: routeTransitionTimeout });
    await expect(page.getByRole("link", { name: /back to dashboard/i })).toHaveAttribute("href", "/dashboard");
    await expect(page.getByRole("link", { name: /back to practice setup/i })).toHaveAttribute("href", "/practice");
    await expect(page.getByRole("link", { name: /practice again/i })).toHaveCount(0);
});

async function continueFromFeedback(
    page: import("@playwright/test").Page,
    isLastQuestion: boolean,
    options: { verifyTranscript?: RegExp } = {},
) {
    await expect(page.getByRole("button", { name: /explore feedback/i })).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: /explore feedback/i }).click();

    if (options.verifyTranscript) {
        await expect(page.getByRole("button", { name: /view your answer/i })).toBeVisible({ timeout: routeTransitionTimeout });
        await page.getByRole("button", { name: /view your answer/i }).click();
        const transcriptPanel = page.getByRole("dialog", { name: /transcript panel/i });
        await expect(transcriptPanel.getByText(options.verifyTranscript)).toBeVisible();
        await page.getByRole("button", { name: /^close transcript$/i }).click();
    } else {
        await expect(page.getByRole("button", { name: /view your answer/i })).toBeVisible({ timeout: routeTransitionTimeout });
        await page.getByRole("button", { name: /view your answer/i }).click();
        await expect(page.getByRole("dialog", { name: /transcript panel/i })).toBeVisible();
        await page.getByRole("button", { name: /^close transcript$/i }).click();
    }

    while (!(await page.getByRole("heading", { name: /ready to continue/i }).isVisible().catch(() => false))) {
        await page.getByRole("button", { name: /^next$/i }).click();
    }

    await page.getByRole("button", {
        name: isLastQuestion ? /^finish session$/i : /^continue to next question$/i,
    }).click();
}

async function skipFromFeedback(page: import("@playwright/test").Page, isLastQuestion: boolean) {
    await expect(page.getByRole("button", { name: /explore feedback/i })).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", {
        name: isLastQuestion ? /skip and finish session/i : /skip and continue to next question/i,
    }).first().click();
}

function createSilentWavBuffer() {
    const sampleRate = 24_000;
    const seconds = 2;
    const dataLength = sampleRate * seconds * 2;
    const buffer = Buffer.alloc(44 + dataLength);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
}
