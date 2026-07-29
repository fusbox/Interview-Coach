"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type ResetRequestResponse = {
    message?: string;
    developmentResetUrl?: string;
};

export function CandidateForgotPasswordExperience({ resetLinkMinutes = 30 }: {
    resetLinkMinutes?: number;
}) {
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [developmentUrl, setDevelopmentUrl] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setMessage(null);
        setDevelopmentUrl(null);
        try {
            const response = await fetch("/candidate/account/password-reset/request", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const result = await response.json().catch(() => ({})) as ResetRequestResponse;
            setMessage(result.message ?? (
                response.ok
                    ? "If that candidate account exists, a password reset email is on its way."
                    : "I couldn't start password recovery. Try again shortly."
            ));
            setDevelopmentUrl(result.developmentResetUrl ?? null);
        } catch {
            setMessage("I couldn't start password recovery. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="candidate-account-panel candidate-account-panel--login" aria-labelledby="forgot-password-title">
            <header className="candidate-account-panel__intro">
                <p className="type-eyebrow">Account recovery</p>
                <h1 id="forgot-password-title">Reset your password.</h1>
                <p>
                    Enter the email for your candidate account. The reset link is valid for{" "}
                    {resetLinkMinutes} minutes.
                </p>
            </header>

            <form className="candidate-account-form" onSubmit={handleSubmit} aria-busy={submitting}>
                <div className="candidate-account-field">
                    <label htmlFor="candidate-recovery-email">Email</label>
                    <input
                        id="candidate-recovery-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        required
                        maxLength={320}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </div>
                <button type="submit" className="candidate-account-submit" disabled={submitting}>
                    {submitting ? <Loader2 className="candidate-account-spin" size={19} /> : null}
                    {submitting ? "Sending" : "Send reset link"}
                    {!submitting ? <ArrowRight size={19} /> : null}
                </button>
            </form>

            {message ? (
                <div className="candidate-account-alert" role="status">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>{message}</span>
                </div>
            ) : null}
            {developmentUrl ? (
                <a href={developmentUrl} className="candidate-account-development-link">
                    Open development reset link
                </a>
            ) : null}

            <p className="candidate-account-panel__switch">
                Remembered your password? <Link href="/candidate/login">Return to sign in</Link>
            </p>
        </section>
    );
}
