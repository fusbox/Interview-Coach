import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CandidateRegistrationExperience } from "./CandidateRegistrationExperience";
import { CandidateVerifyEmailExperience } from "./CandidateVerifyEmailExperience";
import { CandidateLoginExperience } from "./CandidateLoginExperience";
import { CandidateForgotPasswordExperience } from "./CandidateForgotPasswordExperience";
import { CandidateResetPasswordExperience } from "./CandidateResetPasswordExperience";
import { CandidateLogoutButton } from "./CandidateLogoutButton";

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        replace: vi.fn(),
        refresh: vi.fn(),
    }),
}));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("candidate account experiences", () => {
    it("collects the ratified TalentArbor-aligned registration profile", () => {
        render(<CandidateRegistrationExperience />);

        expect(screen.getByRole("heading", {
            name: "Create your Interview Coach account.",
        })).toBeInTheDocument();
        expect(screen.getByLabelText("First name")).toBeRequired();
        expect(screen.getByLabelText("Last name")).toBeRequired();
        expect(screen.getByRole("textbox", { name: "Email" })).toBeRequired();
        expect(screen.getByRole("textbox", { name: /^Phone/ })).toBeRequired();
        expect(screen.getByLabelText("ZIP code")).toBeRequired();
        expect(screen.getByLabelText(/^Password/)).toHaveAttribute("minlength", "12");
        expect(screen.getByLabelText("Confirm password")).toHaveAttribute("minlength", "12");
        expect(screen.getByText(/contact preferences/i)).toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: /terms of use/i })).toBeRequired();
        expect(screen.getByRole("link", { name: "Cookie Policy" })).toHaveAttribute(
            "href",
            "https://talentarbor.com/cookie-policy",
        );
        expect(screen.getByRole("checkbox", { name: /uses ai/i })).toBeRequired();
    });

    it("does not consume an email-verification token until the candidate confirms", async () => {
        const user = userEvent.setup();
        const replaceState = vi.spyOn(window.history, "replaceState");
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                outcome: "verified",
                message: "Your email is verified.",
            }),
        });
        vi.stubGlobal("fetch", fetch);

        render(<CandidateVerifyEmailExperience token={"a".repeat(64)} />);
        expect(fetch).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "Verify email" }));

        expect(fetch).toHaveBeenCalledWith(
            "/candidate/account/verification/consume",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ token: "a".repeat(64) }),
            }),
        );
        expect(await screen.findByRole("heading", { name: "Email verified." })).toBeInTheDocument();
        expect(replaceState).toHaveBeenCalledWith(null, "", "/candidate/verify-email");
    });

    it("offers password recovery from candidate login", () => {
        render(<CandidateLoginExperience nextTarget="/candidate/setup" />);
        expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
            "href",
            "/candidate/forgot-password",
        );
    });

    it("keeps password-reset requests enumeration-safe in the browser", async () => {
        const user = userEvent.setup();
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                message: "If that candidate account exists, a password reset email is on its way.",
            }),
        });
        vi.stubGlobal("fetch", fetch);

        render(<CandidateForgotPasswordExperience />);
        await user.type(screen.getByRole("textbox", { name: "Email" }), "sam@example.com");
        await user.click(screen.getByRole("button", { name: "Send reset link" }));

        expect(await screen.findByText(/if that candidate account exists/i)).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledWith(
            "/candidate/account/password-reset/request",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ email: "sam@example.com" }),
            }),
        );
    });

    it("requires matching passwords and removes a consumed reset token from the URL", async () => {
        const user = userEvent.setup();
        const replaceState = vi.spyOn(window.history, "replaceState");
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                message: "Your password has been reset. Sign in again on each device.",
            }),
        });
        vi.stubGlobal("fetch", fetch);

        render(<CandidateResetPasswordExperience token={"r".repeat(64)} />);
        await user.type(screen.getByLabelText("New password"), "new-candidate-password");
        await user.type(screen.getByLabelText("Confirm new password"), "new-candidate-password");
        await user.click(screen.getByRole("button", { name: "Reset password" }));

        expect(await screen.findByRole("heading", { name: "Password reset." })).toBeInTheDocument();
        expect(replaceState).toHaveBeenCalledWith(null, "", "/candidate/reset-password");
        expect(fetch).toHaveBeenCalledWith(
            "/candidate/account/password-reset/consume",
            expect.objectContaining({
                body: JSON.stringify({
                    token: "r".repeat(64),
                    password: "new-candidate-password",
                }),
            }),
        );
    });

    it("turns a failed sign-out into an explicit retry control", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

        render(<CandidateLogoutButton iconOnly className="candidate-header-logout" />);
        await user.click(screen.getByRole("button", { name: "Sign out" }));

        expect(await screen.findByRole("button", {
            name: "Sign out failed. Try again",
        })).toHaveClass("is-error");
        expect(screen.getByRole("alert")).toHaveTextContent("Sign out failed. Try again.");
    });
});
