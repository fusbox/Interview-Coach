import { expect, test } from "@playwright/test";

type SessionState = {
    id: string;
    role: string;
    status: "NOT_STARTED" | "IN_SESSION" | "AWAITING_EVALUATION" | "REVIEWING" | "COMPLETED";
    questions: Array<{
        id: string;
        text: string;
        category: string;
        index: number;
    }>;
    currentQuestionIndex: number;
    answers: Record<string, {
        questionId: string;
        transcript?: string;
        submittedAt?: number;
        analysis?: {
            contentPulse?: {
                dimension: string;
                headline: string;
                body: string;
            };
            deliveryPulse?: {
                dimension: string;
                headline: string;
                body: string;
            };
            recommendation?: string;
            nextAction?: {
                label: string;
                actionType: "next_question";
            };
            meta?: {
                tier: 2;
                modality: "text";
                confidence: "high";
            };
            transcript?: string;
        };
    }>;
    initialsRequired: boolean;
    candidate: {
        firstName: string;
        lastName: string;
        email: string;
    };
    enteredInitials?: string;
    summaryNarrative?: string;
};

function cloneSession(state: SessionState) {
    return JSON.parse(JSON.stringify(state)) as SessionState;
}

test("candidate can complete a practice session from landing to summary", async ({ page }) => {
    let sessionState: SessionState = {
        id: "session-e2e-1",
        role: "Product Manager",
        status: "NOT_STARTED",
        questions: [{
            id: "question-1",
            text: "Tell me about a time you aligned stakeholders around a difficult product decision.",
            category: "Behavioral",
            index: 0,
        }],
        currentQuestionIndex: 0,
        answers: {},
        initialsRequired: false,
        candidate: {
            firstName: "Taylor",
            lastName: "Candidate",
            email: "taylor.candidate@example.com",
        },
    };

    await page.route("**/api/session/start", async (route) => {
        const request = route.request();
        const body = request.postDataJSON() as { role: string };

        sessionState = {
            ...sessionState,
            role: body.role,
        };

        await route.fulfill({
            status: 200,
            headers: {
                "content-type": "application/json",
                "x-candidate-token": "demo-invite-token",
            },
            body: JSON.stringify(cloneSession(sessionState)),
        });
    });

    await page.route("**/api/session/session-e2e-1", async (route) => {
        const request = route.request();

        if (request.method() === "GET") {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(cloneSession(sessionState)),
            });
            return;
        }

        if (request.method() === "PATCH") {
            const body = request.postDataJSON() as Record<string, unknown>;
            const isCompleted = body.status === "COMPLETED";

            sessionState = {
                ...sessionState,
                ...body,
                summaryNarrative: isCompleted
                    ? "## Executive Summary\n\nYour answer was clear and structured.\n\n## Core Strengths\n\nYour delivery felt steady."
                    : sessionState.summaryNarrative,
            };

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(cloneSession(sessionState)),
            });
            return;
        }

        await route.fallback();
    });

    await page.route("**/api/session/session-e2e-1/questions/question-1/submit", async (route) => {
        const body = route.request().postDataJSON() as { text: string };
        const submittedAt = Date.now();

        sessionState = {
            ...sessionState,
            status: "AWAITING_EVALUATION",
            answers: {
                ...sessionState.answers,
                "question-1": {
                    questionId: "question-1",
                    transcript: body.text,
                    submittedAt,
                },
            },
        };

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(cloneSession(sessionState)),
        });
    });

    await page.route("**/api/session/session-e2e-1/questions/question-1/analysis", async (route) => {
        const transcript = sessionState.answers["question-1"]?.transcript ?? "";

        sessionState = {
            ...sessionState,
            status: "REVIEWING",
            answers: {
                ...sessionState.answers,
                "question-1": {
                    ...sessionState.answers["question-1"],
                        analysis: {
                            contentPulse: {
                                dimension: "structural_clarity",
                                headline: "Your answer was clear and structured.",
                                body: "You connected the product decision to stakeholder outcomes and kept the narrative easy to follow.",
                            },
                            deliveryPulse: {
                                dimension: "resilience",
                                headline: "Your delivery felt steady.",
                                body: "The response showed confidence without rushing and stayed focused on the core decision.",
                            },
                        recommendation: "You covered the decision well. Let’s wrap up this practice round.",
                        nextAction: {
                            label: "Finish session",
                            actionType: "next_question",
                        },
                        meta: {
                            tier: 2,
                            modality: "text",
                            confidence: "high",
                        },
                        transcript,
                    },
                },
            },
        };

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(cloneSession(sessionState)),
        });
    });

    await page.route("**/api/session/session-e2e-1/questions/question-1/answer", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await page.route("**/api/tts", async (route) => {
        await route.fulfill({
            status: 204,
            body: "",
        });
    });

    await page.goto("/s/demo-invite-token");

    await expect(page.getByRole("heading", { name: /get you ready for your interview/i })).toBeVisible();
    const ratingSection = page.locator("div").filter({
        has: page.getByText("How prepared do you feel for your upcoming interview?"),
    }).first();
    await ratingSection.locator("button").nth(2).click();
    await page.getByRole("button", { name: /Begin First Question/i }).click();

    await expect(page.getByText("Tell me about a time you aligned stakeholders around a difficult product decision.")).toBeVisible();

    await page.locator('button[title="Text Mode"]').click();
    await page.locator("#session-answer-text").fill("I aligned product, design, and operations around a phased rollout after mapping the user impact and tradeoffs.");
    await page.getByRole("button", { name: /Submit Answer/i }).click();

    await expect(page.getByText("Your answer was clear and structured.")).toBeVisible();
    await expect(page.getByText("Your delivery felt steady.")).toBeVisible();

    await page.getByRole("button", { name: "Finish Session", exact: true }).click();

    await expect(page.getByText(/Session Complete!/i)).toBeVisible();
    await expect(page.getByText("Your answer was clear and structured.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Practice Again/i })).toBeVisible();
});
