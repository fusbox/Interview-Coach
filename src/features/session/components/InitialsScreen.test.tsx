import { createElement, type HTMLAttributes, type ImgHTMLAttributes } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InitialsScreen from "./InitialsScreen";

const {
    submitInitialsMock,
    prefetchMock,
    unlockMock,
} = vi.hoisted(() => ({
    submitInitialsMock: vi.fn(),
    prefetchMock: vi.fn(),
    unlockMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/image", () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
        const imgProps = { ...props };
        delete imgProps.unoptimized;
        return createElement("img", { ...imgProps, alt: props.alt ?? "" });
    }
}));

vi.mock("framer-motion", () => ({
    motion: {
        div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    },
}));

vi.mock("@/features/audio/audio-engine", () => ({
    audioEngine: {
        unlock: unlockMock,
        prefetch: prefetchMock,
    },
}));

vi.mock("../context/SessionContext", () => ({
    useSession: () => ({
        session: {
            id: "session-1",
            questions: [{ id: "q-1", text: "Tell me about yourself." }],
        },
        candidateToken: "token-1",
        submitInitials: submitInitialsMock,
    }),
}));

describe("InitialsScreen", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("normalizes initials to two uppercase letters", async () => {
        const user = userEvent.setup();

        render(<InitialsScreen />);

        const input = screen.getByLabelText("Enter your initials to begin");
        await user.type(input, "a1b2c");

        expect(input).toHaveValue("AB");
        expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("shows an error and re-enables the button when session start fails", async () => {
        const user = userEvent.setup();
        submitInitialsMock.mockRejectedValueOnce(new Error("start failed"));

        render(<InitialsScreen />);

        await user.type(screen.getByLabelText("Enter your initials to begin"), "PL");
        await user.click(screen.getByRole("button", { name: "Next" }));

        expect(unlockMock).toHaveBeenCalled();
        expect(prefetchMock).toHaveBeenCalledWith("q-1", "Tell me about yourself.", { candidateToken: "token-1", sessionId: "session-1" });

        await waitFor(() => {
            expect(screen.getByText("We couldn't start the session right now. Please try again.")).toBeInTheDocument();
        });

        expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });
});
