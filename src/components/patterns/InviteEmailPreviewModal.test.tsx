import type { ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteEmailPreviewModal } from "./InviteEmailPreviewModal";

vi.mock("next/image", () => ({
    default: ({ unoptimized: _unoptimized, ...props }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
        <img {...props} />
    )
}));

vi.mock("@/app/actions/feedback", () => ({
    captureFeedbackAction: vi.fn().mockResolvedValue({ success: true })
}));

const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSend: vi.fn(),
    data: {
        recipientEmails: ["candidate@example.com"],
        recipientFirstName: "Cand",
        role: "QA Engineer",
        inviteLink: "https://example.com/s/token",
        recruiterName: "Recruiter",
        recruiterEmail: "recruiter@example.com",
    }
};

describe("InviteEmailPreviewModal accessibility", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("focuses the cancel button when the preview opens and closes on Escape", async () => {
        render(<InviteEmailPreviewModal {...baseProps} />);

        const cancelButton = await screen.findByRole("button", { name: "Cancel" });
        await waitFor(() => {
            expect(cancelButton).toHaveFocus();
        });

        fireEvent.keyDown(document, { key: "Escape" });

        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("focuses the primary success action when delivery succeeds", async () => {
        render(
            <InviteEmailPreviewModal
                {...baseProps}
                sendSuccess={true}
                onNewInvite={vi.fn()}
                onDashboard={vi.fn()}
            />
        );

        const primaryButton = await screen.findByRole("button", { name: "Start New Invite" });
        await waitFor(() => {
            expect(primaryButton).toHaveFocus();
        });
    });

    it("announces send errors through an alert region", async () => {
        render(
            <InviteEmailPreviewModal
                {...baseProps}
                errorMessage="Authentication required"
            />
        );

        expect(await screen.findByRole("alert")).toHaveTextContent("Authentication required");
    });
});
