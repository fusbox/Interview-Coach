import { createElement, type ImgHTMLAttributes } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResendInviteButton } from "./ResendInviteButton";

vi.mock("next/image", () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
        const imgProps = { ...props };
        delete imgProps.unoptimized;
        return createElement("img", { ...imgProps, alt: props.alt ?? "" });
    }
}));

vi.mock("@/app/actions/feedback", () => ({
    captureFeedbackAction: vi.fn().mockResolvedValue({ success: true })
}));

describe("ResendInviteButton accessibility", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const baseProps = {
        session: {
            id: "session-1",
            candidateName: "Pat Lee",
            candidateFirstName: "Pat",
            candidateEmail: "pat@example.com",
            role: "QA Engineer",
            status: "NOT_STARTED" as const,
            createdAt: Date.now(),
            questionCount: 3,
            answerCount: 0,
            submittedCount: 0,
            inviteToken: "token-123"
        },
        recruiterProfile: {
            name: "Recruiter",
            title: "Lead Recruiter",
            company: "Company",
            phone: "",
            email: "recruiter@example.com"
        }
    };

    it("opens the resend preview with keyboard focus on the cancel action", async () => {
        const user = userEvent.setup();

        render(<ResendInviteButton {...baseProps} />);

        await user.click(screen.getByRole("button", { name: /resend invite email to pat lee/i }));

        const cancelButton = await screen.findByRole("button", { name: "Cancel" });
        await waitFor(() => {
            expect(cancelButton).toHaveFocus();
        });
    });

    it("announces resend failures through an alert region", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ message: "Failed to resend invite to pat@example.com" })
        }));

        render(<ResendInviteButton {...baseProps} />);

        await user.click(screen.getByRole("button", { name: /resend invite email to pat lee/i }));
        await user.click(await screen.findByRole("button", { name: "Send" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Failed to resend invite to pat@example.com");
    });

    it("moves focus to the primary success action after resend succeeds", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true })
        }));

        render(<ResendInviteButton {...baseProps} />);

        await user.click(screen.getByRole("button", { name: /resend invite email to pat lee/i }));
        await user.click(await screen.findByRole("button", { name: "Send" }));

        const primaryButton = await screen.findByRole("button", { name: "Start New Invite" });
        await waitFor(() => {
            expect(primaryButton).toHaveFocus();
        });
    });
});
