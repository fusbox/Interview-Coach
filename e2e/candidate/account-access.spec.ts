import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const alternateEmail = "candidate-account-alt@talentarbor.local";
const seededPassword = "local-only-candidate";
const resetPassword = "candidate-reset-password-2026";
const recruiterEmail = "recruiter-dev@talentarbor.local";
const recruiterPassword = "local-only-recruiter";
const registrationEmail = "candidate-account-e2e@talentarbor.local";
const registrationPassword = "candidate-registration-password";
const routeTimeout = 30_000;

test.describe.serial("app-owned candidate account milestone", () => {
    test("fresh registration requires explicit verification before candidate login", async ({ page, context }) => {
        test.setTimeout(120_000);
        await page.goto("/candidate/register");
        await page.getByLabel("First name").fill("Milestone");
        await page.getByLabel("Last name").fill("Candidate");
        await page.getByRole("textbox", { name: "Email" }).fill(registrationEmail);
        await page.getByRole("textbox", { name: /^Phone/ }).fill("3125550177");
        await page.getByLabel("ZIP code").fill("60601");
        await page.getByRole("textbox", { name: /^Password/, exact: false }).fill(registrationPassword);
        await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill(registrationPassword);
        await page.getByRole("checkbox", { name: /terms of use/i }).check();
        await page.getByRole("checkbox", { name: /uses ai/i }).check();
        await page.getByRole("button", { name: "Create account" }).click();

        await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible({
            timeout: routeTimeout,
        });
        const verificationUrl = await page.getByRole("link", {
            name: "Open development verification link",
        }).getAttribute("href");
        expect(verificationUrl).toBeTruthy();

        const preVerificationPage = await context.newPage();
        await loginCandidate(preVerificationPage, registrationEmail, registrationPassword, false);
        await expect(preVerificationPage.getByText("Invalid email or password.", {
            exact: true,
        })).toBeVisible();
        await preVerificationPage.close();

        await page.goto(verificationUrl!);
        await expect(page.getByRole("heading", { name: "Verify your email." })).toBeVisible();
        await page.getByRole("button", { name: "Verify email" }).click();
        await expect(page.getByRole("heading", { name: "Email verified." })).toBeVisible();
        await page.getByRole("link", { name: "Continue to sign in" }).click();
        await loginCandidate(page, registrationEmail, registrationPassword);
        await expect(page).toHaveURL(/\/candidate\/setup$/, { timeout: routeTimeout });
        await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
        await page.getByRole("button", { name: "Sign out" }).click();
        await expect(page).toHaveURL(/\/candidate\/login$/, { timeout: routeTimeout });
    });

    test("password reset revokes two browser sessions and cannot be replayed", async ({ browser }) => {
        test.setTimeout(120_000);
        const firstDevice = await newCandidateContext(browser);
        const secondDevice = await newCandidateContext(browser);
        const recoveryDevice = await newCandidateContext(browser);
        try {
            const firstPage = await firstDevice.newPage();
            const secondPage = await secondDevice.newPage();
            const recoveryPage = await recoveryDevice.newPage();
            await loginCandidate(firstPage, registrationEmail, registrationPassword);
            await loginCandidate(secondPage, registrationEmail, registrationPassword);
            await expect(firstPage).toHaveURL(/\/candidate\/(?:dashboard|setup)(?:[/?]|$)/, {
                timeout: routeTimeout,
            });
            await expect(secondPage).toHaveURL(/\/candidate\/(?:dashboard|setup)(?:[/?]|$)/, {
                timeout: routeTimeout,
            });

            await recoveryPage.goto("/candidate/forgot-password");
            await recoveryPage.getByRole("textbox", { name: "Email" }).fill(registrationEmail);
            await recoveryPage.getByRole("button", { name: "Send reset link" }).click();
            const resetUrl = await recoveryPage.getByRole("link", {
                name: "Open development reset link",
            }).getAttribute("href");
            expect(resetUrl).toBeTruthy();
            await recoveryPage.goto(resetUrl!);
            await recoveryPage.getByRole("textbox", { name: "New password", exact: true }).fill(resetPassword);
            await recoveryPage.getByRole("textbox", { name: "Confirm new password", exact: true }).fill(resetPassword);
            await recoveryPage.getByRole("button", { name: "Reset password" }).click();
            await expect(recoveryPage.getByRole("heading", { name: "Password reset." })).toBeVisible();

            await firstPage.goto("/candidate/setup");
            await secondPage.goto("/candidate/setup");
            await expect(firstPage).toHaveURL(/\/candidate\/login\?next=/, { timeout: routeTimeout });
            await expect(secondPage).toHaveURL(/\/candidate\/login\?next=/, { timeout: routeTimeout });

            await loginCandidate(firstPage, registrationEmail, registrationPassword, false);
            await expect(firstPage.getByText("Invalid email or password.", {
                exact: true,
            })).toBeVisible();
            await loginCandidate(firstPage, registrationEmail, resetPassword);
            await expect(firstPage).toHaveURL(/\/candidate\/(?:dashboard|setup)(?:[/?]|$)/, {
                timeout: routeTimeout,
            });

            await recoveryPage.goto(resetUrl!);
            await recoveryPage.getByRole("textbox", { name: "New password", exact: true }).fill("another-candidate-password");
            await recoveryPage.getByRole("textbox", { name: "Confirm new password", exact: true }).fill("another-candidate-password");
            await recoveryPage.getByRole("button", { name: "Reset password" }).click();
            await expect(recoveryPage.getByRole("status")).toContainText(
                "invalid or has already been used",
            );
        } finally {
            await firstDevice.close();
            await secondDevice.close();
            await recoveryDevice.close();
        }
    });

    test("durable session continuity does not weaken cross-candidate ownership", async ({ browser }) => {
        test.setTimeout(180_000);
        const primary = await newCandidateContext(browser);
        const recovered = await newCandidateContext(browser);
        const alternate = await newCandidateContext(browser);
        try {
            const primaryPage = await primary.newPage();
            await loginCandidate(primaryPage, registrationEmail, resetPassword);
            await primaryPage.goto("/candidate/setup");
            const role = `Account Milestone Specialist ${Date.now()}`;
            await primaryPage.getByLabel("Target role *").fill(role);
            await primaryPage.getByLabel("Job description *").fill(
                "Review account records, resolve discrepancies, communicate findings, and document outcomes.",
            );
            await primaryPage.getByRole("button", { name: /^Screening call/i }).click();
            await primaryPage.getByRole("button", { name: "3", exact: true }).click();
            await primaryPage.getByRole("button", { name: "Start practice" }).click();
            await expect(primaryPage).toHaveURL(/\/candidate\/session\/[0-9a-f-]+$/, {
                timeout: routeTimeout,
            });
            const sessionUrl = new URL(primaryPage.url()).pathname;
            await expect(primaryPage.getByRole("heading", { name: "Your practice is ready." })).toBeVisible();

            const recoveredPage = await recovered.newPage();
            await loginCandidate(recoveredPage, registrationEmail, resetPassword);
            await recoveredPage.goto(sessionUrl);
            await expect(recoveredPage.getByRole("heading", { name: "Your practice is ready." })).toBeVisible();
            await expect(recoveredPage.getByRole("heading", { name: role })).toBeVisible();

            const alternatePage = await alternate.newPage();
            await loginCandidate(alternatePage, alternateEmail, seededPassword);
            await alternatePage.goto(sessionUrl);
            await expect(alternatePage.getByRole("heading", {
                name: "I need the setup details for this practice round.",
            })).toBeVisible();
            const mutationStatus = await alternatePage.evaluate(async (path) => {
                const response = await fetch(`${path}/answer-drafts`, {
                    method: "PUT",
                    credentials: "same-origin",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        slotId: "q1",
                        questionIndex: 0,
                        mode: "text",
                        text: "cross-candidate mutation",
                    }),
                });
                return response.status;
            }, sessionUrl);
            expect(mutationStatus).toBe(404);
        } finally {
            await primary.close();
            await recovered.close();
            await alternate.close();
        }
    });

    test("candidate, recruiter, and host cookies coexist without audience crossover", async ({ page, context }) => {
        test.setTimeout(120_000);
        await loginCandidate(page, registrationEmail, resetPassword);
        await expect(page).toHaveURL(/\/candidate\/dashboard|\/candidate\/setup/, {
            timeout: routeTimeout,
        });

        await loginRecruiter(page);
        await expect(page).toHaveURL(/\/recruiter\/dashboard$/, { timeout: routeTimeout });
        await expect(page.getByRole("heading", { name: "Invitations" })).toBeVisible();
        await page.goto("/candidate/setup");
        await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

        expect(await postFromPage(page, "/candidate/account/logout")).toBe(200);
        await page.goto("/recruiter/dashboard");
        await expect(page.getByRole("heading", { name: "Invitations" })).toBeVisible();

        await loginCandidate(page, registrationEmail, resetPassword);
        expect(await postFromPage(page, "/api/auth/logout")).toBe(200);
        await page.goto("/candidate/setup");
        await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

        await page.goto("/candidate/dev/launch?candidate=alternate&next=/candidate/setup");
        await expect(page).toHaveURL(/\/candidate\/setup$/, { timeout: routeTimeout });
        await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

        await context.addCookies([{
            name: "ic_candidate_app_session",
            value: "invalid-app-session",
            url: process.env.PLAYWRIGHT_BASE_URL!,
            httpOnly: true,
            sameSite: "Lax",
        }]);
        await page.goto("/candidate/setup");
        await expect(page).toHaveURL(/\/candidate\/login\?next=/, { timeout: routeTimeout });

        expect(await postFromPage(page, "/candidate/account/logout")).toBe(200);
        await page.goto("/candidate/setup");
        await expect(page).toHaveURL(/\/candidate\/setup$/, { timeout: routeTimeout });
        await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    });
});

async function newCandidateContext(browser: Browser): Promise<BrowserContext> {
    return browser.newContext({
        baseURL: process.env.PLAYWRIGHT_BASE_URL,
        viewport: { width: 1280, height: 900 },
    });
}

async function loginCandidate(
    page: Page,
    email: string,
    password: string,
    expectSuccess = true,
) {
    await page.goto("/candidate/login");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    if (expectSuccess) {
        await expect(page).toHaveURL(/\/candidate\/(?:dashboard|setup)(?:[/?]|$)/, {
            timeout: routeTimeout,
        });
    }
}

async function loginRecruiter(page: Page) {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill(recruiterEmail);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(recruiterPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
}

async function postFromPage(page: Page, path: string) {
    return page.evaluate(async (target) => {
        const response = await fetch(target, {
            method: "POST",
            credentials: "same-origin",
        });
        return response.status;
    }, path);
}
