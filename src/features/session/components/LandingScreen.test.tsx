import { createElement, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandingScreen from "./LandingScreen";

vi.mock("next/image", () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", { ...props, alt: props.alt ?? "" })
}));

vi.mock("@/features/audio/audio-engine", () => ({
    audioEngine: {
        prefetch: vi.fn(),
        unlock: vi.fn().mockResolvedValue(undefined),
    }
}));

vi.mock("@/app/actions/feedback", () => ({
    captureFeedbackAction: vi.fn()
}));

vi.mock("../context/SessionContext", () => ({
    useSession: vi.fn()
}));

import { captureFeedbackAction } from "@/app/actions/feedback";
import { useSession } from "../context/SessionContext";

const mockUseSession = vi.mocked(useSession);
const mockCaptureFeedbackAction = vi.mocked(captureFeedbackAction);

describe("LandingScreen accessibility", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSession.mockReturnValue({
            session: {
                id: "session-1",
                questions: [{ id: "q-1", text: "Tell me about yourself." }],
                candidate: { firstName: "Pat", lastName: "Lee" },
                enteredInitials: "PL",
            },
            candidateToken: "token-1",
        } as ReturnType<typeof useSession>);
    });

    it("announces baseline feedback save failures through an alert region", async () => {
        mockCaptureFeedbackAction.mockRejectedValueOnce(new Error("save failed"));

        render(<LandingScreen onStart={vi.fn()} role="QA Engineer" />);

        fireEvent.click(screen.getByTitle("Rate 3/5"));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "We couldn't save that response right now. You can still continue."
            );
        });
    });

    it("keeps the begin button disabled until a baseline rating is selected", () => {
        mockCaptureFeedbackAction.mockResolvedValue({ success: true } as never);

        render(<LandingScreen onStart={vi.fn()} role="QA Engineer" />);

        expect(screen.getByRole("button", { name: "Begin First Question" })).toBeDisabled();

        fireEvent.click(screen.getByTitle("Rate 4/5"));

        expect(screen.getByRole("button", { name: "Begin First Question" })).toBeEnabled();
    });
});
