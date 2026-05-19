import { expect, test } from "@playwright/test";

const routeTransitionTimeout = 30_000;

test("seeded candidate can move from practice setup to session summary", async ({ page }) => {
    test.setTimeout(90_000);
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

    await page.getByRole("button", { name: /record answer/i }).click();
    await expect(page.getByText(/listening/i)).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /record answer/i }).click();
    await expect(page.getByText(/audio captured/i)).toBeVisible();
    await page.getByRole("button", { name: /submit recording/i }).click();

    await expect(page.getByText(/reviewing answer content/i)).toBeVisible();
    await expect(page.getByText(/I noted your answer/i)).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: /continue to next question/i }).click();

    await expect(page.getByText(/Question 2 of 3/i)).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: /text mode/i }).click();
    await page.getByLabel(/type your answer/i).fill(
        "I separate urgency from impact, name the tradeoff, and make the decision criteria visible before recommending a path.",
    );
    await page.getByRole("button", { name: /submit answer/i }).click();
    await expect(page.getByText(/I separate urgency from impact/i)).toBeVisible();
    await expect(page.getByText(/I noted your answer/i)).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: /continue to next question/i }).click();

    await expect(page.getByText(/Question 3 of 3/i)).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: /text mode/i }).click();
    await page.getByLabel(/type your answer/i).fill(
        "I start with the customer problem, validate the workflow with users, and then turn the evidence into a small testable plan.",
    );
    await page.getByRole("button", { name: /submit answer/i }).click();
    await expect(page.getByText(/I start with the customer problem/i)).toBeVisible();
    await expect(page.getByText(/I noted your answer/i)).toBeVisible({ timeout: routeTransitionTimeout });
    await page.getByRole("button", { name: /finish session/i }).click();

    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+$/i, { timeout: routeTransitionTimeout });
    await expect(page.getByText("Session complete")).toBeVisible();

    const sessionUrl = page.url();
    const sessionId = sessionUrl.split("/session/")[1]?.split(/[?#]/)[0];
    expect(sessionId).toBeTruthy();

    await page.goto(`/summary/${sessionId}`);

    await expect(page.getByRole("heading", { name: /Customer Success Manager summary/i })).toBeVisible();
    await expect(page.getByText(/I separate urgency from impact/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /practice again/i })).toHaveAttribute("href", "/practice");
});

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
