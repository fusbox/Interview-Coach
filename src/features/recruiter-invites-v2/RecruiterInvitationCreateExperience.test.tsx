import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecruiterInvitationCreateExperience } from "./RecruiterInvitationCreateExperience";

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("RecruiterInvitationCreateExperience", () => {
    it("changes only the fixed slot count when stage changes", async () => {
        render(<RecruiterInvitationCreateExperience />);
        expect(screen.getAllByLabelText(/^Q\d/)).toHaveLength(5);

        await userEvent.click(screen.getByRole("button", { name: /First interview, 7 questions/i }));
        expect(screen.getAllByLabelText(/^Q\d/)).toHaveLength(7);

        await userEvent.click(screen.getByRole("button", { name: /Follow-up interview, 10 questions/i }));
        expect(screen.getAllByLabelText(/^Q\d/)).toHaveLength(10);
    });

    it("locks a generated set and Start over clears and unlocks every slot", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
            status: "questions_ready",
            outcome: "created",
            questionSetId: "30000000-0000-4000-8000-000000000001",
            source: "generated",
            targetRole: "Quality Inspector",
            interviewStage: "screening",
            questionCount: 5,
            questions: Array.from({ length: 5 }, (_, index) => ({
                slotId: `slot-${index + 1}`,
                index,
                category: "screening",
                label: "Screening",
                questionText: `Generated question ${index + 1}?`,
            })),
        }), { status: 201, headers: { "content-type": "application/json" } }));
        render(<RecruiterInvitationCreateExperience />);

        await userEvent.type(screen.getByLabelText("Target role *"), "Quality Inspector");
        await userEvent.type(screen.getByLabelText("Job description *"), "Inspect finished goods.");
        await userEvent.click(screen.getByRole("button", { name: "Generate questions" }));

        await screen.findByText("Generated set accepted");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        screen.getAllByLabelText(/^Q\d/).forEach((textarea, index) => {
            expect(textarea).toHaveAttribute("readonly");
            expect(textarea).toHaveValue(`Generated question ${index + 1}?`);
        });

        await userEvent.click(screen.getByRole("button", { name: "Start over" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Generate questions" })).toBeEnabled());
        screen.getAllByLabelText(/^Q\d/).forEach((textarea) => {
            expect(textarea).not.toHaveAttribute("readonly");
            expect(textarea).toHaveValue("");
        });
    });

    it("does not permit manual acceptance until every fixed slot is complete", () => {
        render(<RecruiterInvitationCreateExperience />);
        fireEvent.change(screen.getByLabelText("Target role *"), { target: { value: "Quality Inspector" } });
        fireEvent.change(screen.getByLabelText("Job description *"), { target: { value: "Inspect finished goods." } });
        expect(screen.getByRole("button", { name: "Use these questions" })).toBeDisabled();
        screen.getAllByLabelText(/^Q\d/).forEach((textarea, index) => {
            fireEvent.change(textarea, { target: { value: `Manual question ${index + 1}?` } });
        });
        expect(screen.getByRole("button", { name: "Use these questions" })).toBeEnabled();
    });

    it("keeps email delivery separate from creation and preserves both copy fallbacks", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        });
        vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
        const copyMessage = "Hi Irma,\n\nOpen your personal practice link: https://interviewcoach.example/s/token";
        const fetchMock = vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(jsonResponse(readyQuestions(), 201))
            .mockResolvedValueOnce(jsonResponse({
                status: "invitations_created",
                outcome: "created",
                batchId: "40000000-0000-4000-8000-000000000001",
                targetRole: "Quality Inspector",
                recipients: [{
                    recipientId: "50000000-0000-4000-8000-000000000001",
                    sessionId: "60000000-0000-4000-8000-000000000001",
                    firstName: "Irma",
                    lastName: "Castillo",
                    email: "irma@example.com",
                    inviteLink: "https://interviewcoach.example/s/token",
                    copyMessage,
                    tokenExpiresAt: "2026-08-02T00:00:00.000Z",
                }],
            }, 201))
            .mockResolvedValueOnce(jsonResponse({
                status: "delivery_processed",
                batchId: "40000000-0000-4000-8000-000000000001",
                summary: { acceptedCount: 1, retryableFailureCount: 0, blockedCount: 0 },
                recipients: [{
                    recipientId: "50000000-0000-4000-8000-000000000001",
                    attemptId: "70000000-0000-4000-8000-000000000001",
                    attemptNumber: 1,
                    status: "provider_accepted",
                    retryable: false,
                    failureCode: null,
                }],
            }));
        render(<RecruiterInvitationCreateExperience />);

        fireEvent.change(screen.getByLabelText("Target role *"), { target: { value: "Quality Inspector" } });
        fireEvent.change(screen.getByLabelText("Job description *"), { target: { value: "Inspect finished goods." } });
        await userEvent.click(screen.getByRole("button", { name: "Generate questions" }));
        await screen.findByRole("heading", { name: "Candidates" });
        fireEvent.change(screen.getByLabelText("First name *"), { target: { value: "Irma" } });
        fireEvent.change(screen.getByLabelText("Last name *"), { target: { value: "Castillo" } });
        fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "irma@example.com" } });
        await userEvent.click(screen.getByRole("button", { name: "Review invitations" }));
        expect(screen.getByText("Not sent yet")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Create invitations" }));

        expect(await screen.findByRole("heading", { name: "Share the invitations" })).toBeInTheDocument();
        expect(screen.getByText("Ready to share")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Manage invitations/ })).toHaveAttribute(
            "href",
            "/recruiter/invitations/40000000-0000-4000-8000-000000000001",
        );
        await userEvent.click(screen.getByRole("button", { name: "Copy message" }));
        expect(writeText).toHaveBeenCalledWith(copyMessage);
        await userEvent.click(screen.getByRole("button", { name: "Send invitations" }));

        expect((await screen.findAllByText("Accepted by email provider")).length).toBeGreaterThan(0);
        expect(fetchMock).toHaveBeenLastCalledWith("/api/recruiter/invitations/delivery", expect.objectContaining({
            method: "POST",
        }));
    });
});

function readyQuestions() {
    return {
        status: "questions_ready",
        outcome: "created",
        questionSetId: "30000000-0000-4000-8000-000000000001",
        source: "generated",
        targetRole: "Quality Inspector",
        interviewStage: "screening",
        questionCount: 5,
        questions: Array.from({ length: 5 }, (_, index) => ({
            slotId: `slot-${index + 1}`,
            index,
            category: "screening",
            label: "Screening",
            questionText: `Generated question ${index + 1}?`,
        })),
    };
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}
