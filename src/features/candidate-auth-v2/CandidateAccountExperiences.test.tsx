import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CandidateRegistrationExperience } from "./CandidateRegistrationExperience";
import { CandidateVerifyEmailExperience } from "./CandidateVerifyEmailExperience";
import { CandidateLoginExperience } from "./CandidateLoginExperience";
import { CandidateForgotPasswordExperience } from "./CandidateForgotPasswordExperience";
import { CandidateResetPasswordExperience } from "./CandidateResetPasswordExperience";
import { CandidateLogoutButton } from "./CandidateLogoutButton";

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

    it("guards and formats candidate registration identity inputs", () => {
        render(<CandidateRegistrationExperience />);

        const firstName = screen.getByLabelText("First name");
        const lastName = screen.getByLabelText("Last name");
        const email = screen.getByRole("textbox", { name: "Email" });
        const phone = screen.getByRole("textbox", { name: /^Phone/ });
        const postalCode = screen.getByLabelText("ZIP code");

        expect(firstName).toHaveAttribute("maxlength", "80");
        expect(lastName).toHaveAttribute("maxlength", "80");
        expect(email).toHaveAttribute("type", "email");
        expect(email).toHaveAttribute("inputmode", "email");
        expect(email).toHaveAttribute("maxlength", "320");
        expect(email).toHaveAttribute("pattern", String.raw`[^\s@]+@[^\s@]+\.[^\s@]+`);
        expect(phone).toHaveAttribute("inputmode", "tel");
        expect(phone).toHaveAttribute(
            "pattern",
            String.raw`(?:\([0-9]{3}\) [0-9]{3}-[0-9]{4}|\+[1-9][0-9]{7,14})`,
        );
        expect(postalCode).toHaveAttribute("inputmode", "numeric");
        expect(postalCode).toHaveAttribute("maxlength", "5");
        expect(postalCode).toHaveAttribute("pattern", "[0-9]{5}");

        fireEvent.change(email, { target: { value: " Sam @Example.com " } });
        fireEvent.change(phone, { target: { value: "1 (312) 555-0100" } });
        fireEvent.change(postalCode, { target: { value: "02134-9999" } });

        expect(email).toHaveValue("Sam@Example.com");
        expect(phone).toHaveValue("(312) 555-0100");
        expect(postalCode).toHaveValue("02134");
        expect(phone).toHaveAccessibleDescription("10 digits or +country code");
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

    it("replaces the login document after the candidate session is established", async () => {
        const user = userEvent.setup();
        const replace = vi.fn();
        const originalLocation = window.location;
        Object.defineProperty(window, "location", {
            configurable: true,
            value: {
                ...originalLocation,
                replace,
            },
        });
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: "authenticated" }),
        });
        vi.stubGlobal("fetch", fetch);

        try {
            render(<CandidateLoginExperience nextTarget="/candidate/dashboard?prep=prep-1" />);
            await user.type(screen.getByRole("textbox", { name: "Email" }), "candidate@example.com");
            await user.type(screen.getByLabelText("Password"), "candidate-password");
            await user.click(screen.getByRole("button", { name: "Sign in" }));

            await waitFor(() => {
                expect(replace).toHaveBeenCalledWith("/candidate/dashboard?prep=prep-1");
            });
            expect(screen.getByRole("button", { name: "Signing in" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Signing in" }).closest("form")).toHaveAttribute(
                "aria-busy",
                "true",
            );
            expect(fetch).toHaveBeenCalledWith(
                "/candidate/account/login",
                expect.objectContaining({
                    method: "POST",
                    credentials: "same-origin",
                }),
            );
        } finally {
            Object.defineProperty(window, "location", {
                configurable: true,
                value: originalLocation,
            });
        }
    });

    it("restores candidate login after a recoverable failure", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ message: "Sign in failed." }),
        }));

        render(<CandidateLoginExperience nextTarget="/candidate/setup" />);
        await user.type(screen.getByRole("textbox", { name: "Email" }), "candidate@example.com");
        await user.type(screen.getByLabelText("Password"), "incorrect-password");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Sign in failed.");
        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Sign in" }).closest("form")).toHaveAttribute(
            "aria-busy",
            "false",
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

    it("keeps candidate sign-out pending after navigation accepts the handoff", async () => {
        const user = userEvent.setup();
        const navigate = vi.fn();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

        render(<CandidateLogoutButton navigate={navigate} />);
        await user.click(screen.getByRole("button", { name: "Sign out" }));

        await waitFor(() => expect(navigate).toHaveBeenCalledWith("/candidate/login"));
        expect(screen.getByRole("button", { name: "Signing out" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Signing out" })).toHaveAttribute("aria-busy", "true");
    });
});
