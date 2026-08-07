import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecruiterLoginExperience } from "./RecruiterLoginExperience";

const router = vi.hoisted(() => ({
    replace: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => router,
}));

afterEach(() => {
    vi.unstubAllGlobals();
    router.replace.mockReset();
    router.refresh.mockReset();
});

describe("RecruiterLoginExperience", () => {
    it("uses the shared account-entry composition without candidate account creation", () => {
        render(<RecruiterLoginExperience nextTarget="/recruiter/dashboard" />);

        expect(screen.getByText("Recruiter access")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sign in" }).closest("form")).toHaveClass(
            "candidate-account-form",
            "candidate-account-form--login",
        );
        expect(screen.getByRole("button", { name: "Sign in" }).closest(".candidate-account-panel")).toHaveClass(
            "candidate-account-panel--login",
        );
        expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument();
        expect(screen.queryByText("Need a new verification email?")).not.toBeInTheDocument();
    });

    it("keeps sign-in pending after navigation accepts the handoff", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
        })));

        render(<RecruiterLoginExperience nextTarget="/recruiter/dashboard" />);
        await user.type(screen.getByRole("textbox", { name: "Email" }), "recruiter@example.com");
        await user.type(screen.getByLabelText("Password"), "recruiter-password");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/recruiter/dashboard"));
        expect(router.refresh).toHaveBeenCalledOnce();
        expect(screen.getByRole("button", { name: "Signing in" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Signing in" }).closest("form")).toHaveAttribute(
            "aria-busy",
            "true",
        );
    });

    it("restores sign-in after a recoverable failure", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: "Sign in failed.",
        }), {
            status: 401,
            headers: { "content-type": "application/json" },
        })));

        render(<RecruiterLoginExperience nextTarget="/recruiter/dashboard" />);
        await user.type(screen.getByRole("textbox", { name: "Email" }), "recruiter@example.com");
        await user.type(screen.getByLabelText("Password"), "incorrect-password");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Sign in failed.");
        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Sign in" }).closest("form")).toHaveAttribute(
            "aria-busy",
            "false",
        );
        expect(router.replace).not.toHaveBeenCalled();
    });
});
