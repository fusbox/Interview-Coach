"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

type ResendResponse = {
    message?: string;
    developmentVerificationUrl?: string;
};

export function CandidateVerificationResend({
    initialEmail = "",
}: {
    initialEmail?: string;
}) {
    const [email, setEmail] = useState(initialEmail);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [developmentUrl, setDevelopmentUrl] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setMessage(null);
        setDevelopmentUrl(null);
        try {
            const response = await fetch("/candidate/account/verification/resend", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const result = await response.json().catch(() => ({})) as ResendResponse;
            setMessage(result.message ?? (
                response.ok
                    ? "If that account needs verification, a new email is on its way."
                    : "I couldn't send that email. Try again shortly."
            ));
            setDevelopmentUrl(result.developmentVerificationUrl ?? null);
        } catch {
            setMessage("I couldn't send that email. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form className="candidate-account-resend" onSubmit={handleSubmit}>
            <label htmlFor="candidate-resend-email">Email</label>
            <div className="candidate-account-resend__row">
                <input
                    id="candidate-resend-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    maxLength={320}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                <button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="candidate-account-spin" size={18} /> : <ArrowRight size={18} />}
                    {submitting ? "Sending" : "Send again"}
                </button>
            </div>
            {message ? <p role="status">{message}</p> : null}
            {developmentUrl ? (
                <a href={developmentUrl} className="candidate-account-development-link">
                    Open development verification link
                </a>
            ) : null}
        </form>
    );
}
