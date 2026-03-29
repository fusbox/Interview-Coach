import { createElement, type ImgHTMLAttributes } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepPreviewCombined } from "./StepPreviewCombined";

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

describe("StepPreviewCombined accessibility", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const baseProps = {
        details: { role: "QA Engineer", jd: "", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-1" },
        star: [],
        perma: [],
        technical: [],
        candidates: [{ id: "c1", firstName: "Pat", lastName: "Lee", email: "pat@example.com" }],
        onBack: () => {},
        onHandleCreate: async () => {},
        isLoading: false,
        isGenerated: true,
        results: [{ id: "s1", firstName: "Pat", lastName: "Lee", email: "pat@example.com", link: "https://example.com/s/token" }],
        failures: [],
        summary: null,
        error: null,
        recruiterProfile: { name: "Recruiter", email: "recruiter@example.com", phone: "", title: "Lead", company: "Company" },
        onNewInvite: () => {},
        onDashboard: () => {}
    };

    it("opens the invite preview with keyboard-focus on the cancel action", async () => {
        render(<StepPreviewCombined {...baseProps} />);

        const cancelButton = await screen.findByRole("button", { name: "Cancel" });
        await waitFor(() => {
            expect(cancelButton).toHaveFocus();
        });
    });

    it("announces send failures in the preview flow", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ message: "Authentication required" })
        }));

        render(<StepPreviewCombined {...baseProps} />);

        await user.click(await screen.findByRole("button", { name: "Send" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Authentication required");
    });
});
