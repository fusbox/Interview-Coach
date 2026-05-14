import { expect, test } from "@playwright/test";

const routeTransitionTimeout = 15_000;

test("seeded candidate can move from practice setup to session summary", async ({ page }) => {
    await page.goto("/practice");

    await expect(page.getByRole("heading", { name: /set up your practice/i })).toBeVisible();
    await expect(page.getByLabel(/target role/i)).toHaveValue("Customer Success Manager");
    await expect(page.getByText("Customer success leader with SaaS onboarding and renewal experience.")).toBeVisible();

    await page.getByRole("button", { name: /start generating questions/i }).click();

    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+$/i, { timeout: routeTransitionTimeout });
    await expect(page.getByRole("heading", { name: "Customer Success Manager", exact: true })).toBeVisible();
    await expect(page.getByText(/Tell me about a time you had to lead a Customer Success Manager initiative/i)).toBeVisible();

    await page.getByRole("button", { name: /^start practice$/i }).click();
    await expect(page.getByText("IN_SESSION")).toBeVisible();

    await page.getByLabel(/your answer/i).fill(
        "I mapped customer onboarding blockers, aligned success and support on a shared playbook, and improved renewal readiness for strategic accounts.",
    );
    await page.getByRole("button", { name: /save answer/i }).click();

    await expect(page.getByText(/I mapped customer onboarding blockers/i)).toBeVisible();
    await page.getByRole("button", { name: /get coaching/i }).click();
    await expect(page.getByText(/I noted your answer/i)).toBeVisible();
    await page.getByRole("button", { name: /next question/i }).click();

    await expect(page.getByText(/How do you prioritize conflicting stakeholder requirements/i)).toBeVisible();
    await page.getByLabel(/your answer/i).fill(
        "I separate urgency from impact, name the tradeoff, and make the decision criteria visible before recommending a path.",
    );
    await page.getByRole("button", { name: /save answer/i }).click();
    await expect(page.getByText(/I separate urgency from impact/i)).toBeVisible();
    await page.getByRole("button", { name: /get coaching/i }).click();
    await expect(page.getByText(/I noted your answer/i)).toBeVisible();
    await page.getByRole("button", { name: /next question/i }).click();

    await expect(page.getByText(/Describe your approach to product discovery/i)).toBeVisible();
    await page.getByLabel(/your answer/i).fill(
        "I start with the customer problem, validate the workflow with users, and then turn the evidence into a small testable plan.",
    );
    await page.getByRole("button", { name: /save answer/i }).click();
    await expect(page.getByText(/I start with the customer problem/i)).toBeVisible();
    await page.getByRole("button", { name: /get coaching/i }).click();
    await expect(page.getByText(/I noted your answer/i)).toBeVisible();
    await page.getByRole("button", { name: /finish session/i }).click();

    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+$/i, { timeout: routeTransitionTimeout });
    await expect(page.getByText("COMPLETED")).toBeVisible();

    const sessionUrl = page.url();
    const sessionId = sessionUrl.split("/session/")[1]?.split(/[?#]/)[0];
    expect(sessionId).toBeTruthy();

    await page.goto(`/summary/${sessionId}`);

    await expect(page.getByRole("heading", { name: /Customer Success Manager summary/i })).toBeVisible();
    await expect(page.getByText(/I mapped customer onboarding blockers/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /practice again/i })).toHaveAttribute("href", "/practice");
});
