"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

export function CandidateResetPasswordExperience({ token }: { token?: string }) {
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [outcome, setOutcome] = useState<"ready" | "reset" | "failed">(token ? "ready" : "failed");
    const [message, setMessage] = useState(token
        ? "Choose a new password. You will sign in again on each device."
        : "This password reset link is incomplete. Request a new one.");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!token) return;
        if (password !== confirmation) {
            setOutcome("failed");
            setMessage("The passwords do not match.");
            return;
        }

        setSubmitting(true);
        setOutcome("ready");
        try {
            const response = await fetch("/candidate/account/password-reset/consume", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const result = await response.json().catch(() => ({})) as { message?: string };
            setMessage(result.message ?? (
                response.ok
                    ? "Your password has been reset."
                    : "I couldn't reset your password."
            ));
            setOutcome(response.ok ? "reset" : "failed");
            if (response.ok) {
                setPassword("");
                setConfirmation("");
                window.history.replaceState(null, "", "/candidate/reset-password");
            }
        } catch {
            setOutcome("failed");
            setMessage("I couldn't reset your password. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="candidate-account-panel candidate-account-panel--message" aria-labelledby="reset-password-title">
            <span className={`candidate-account-panel__status${outcome === "failed" ? " is-error" : ""}`} aria-hidden="true">
                {outcome === "reset"
                    ? <CheckCircle2 size={24} />
                    : outcome === "failed"
                        ? <AlertCircle size={24} />
                        : <KeyRound size={24} />}
            </span>
            <p className="type-eyebrow">Account recovery</p>
            <h1 id="reset-password-title">
                {outcome === "reset" ? "Password reset." : "Choose a new password."}
            </h1>
            <p role="status">{message}</p>

            {token && outcome !== "reset" ? (
                <form className="candidate-account-form" onSubmit={handleSubmit} aria-busy={submitting}>
                    <div className="candidate-account-field">
                        <label htmlFor="candidate-reset-password">New password</label>
                        <span className="candidate-account-password">
                            <input
                                id="candidate-reset-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                required
                                minLength={12}
                                maxLength={128}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((visible) => !visible)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </span>
                    </div>
                    <div className="candidate-account-field">
                        <label htmlFor="candidate-reset-confirmation">Confirm new password</label>
                        <input
                            id="candidate-reset-confirmation"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={12}
                            maxLength={128}
                            value={confirmation}
                            onChange={(event) => setConfirmation(event.target.value)}
                        />
                    </div>
                    <button type="submit" className="candidate-account-submit" disabled={submitting}>
                        {submitting ? <Loader2 className="candidate-account-spin" size={19} /> : null}
                        {submitting ? "Resetting" : "Reset password"}
                        {!submitting ? <ArrowRight size={19} /> : null}
                    </button>
                </form>
            ) : null}

            {outcome === "reset" ? (
                <Link href="/candidate/login" className="candidate-account-primary-link">
                    Sign in with your new password
                    <ArrowRight size={18} />
                </Link>
            ) : null}
            {outcome === "failed" ? (
                <Link href="/candidate/forgot-password" className="candidate-account-secondary-link">
                    Request a new reset link
                </Link>
            ) : null}
        </section>
    );
}
