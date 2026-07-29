"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, MailCheck } from "lucide-react";

import { CandidateVerificationResend } from "./CandidateVerificationResend";

export function CandidateVerifyEmailExperience({ token }: { token?: string }) {
    const [submitting, setSubmitting] = useState(false);
    const [outcome, setOutcome] = useState<"ready" | "verified" | "failed">(token ? "ready" : "failed");
    const [message, setMessage] = useState(token
        ? "Confirm this email verification to activate your account."
        : "This verification link is incomplete. Request a new email.");

    async function verify() {
        if (!token) return;
        setSubmitting(true);
        try {
            const response = await fetch("/candidate/account/verification/consume", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const result = await response.json().catch(() => ({})) as { message?: string };
            setMessage(result.message ?? (response.ok ? "Your email is verified." : "Verification failed."));
            setOutcome(response.ok ? "verified" : "failed");
            if (response.ok) {
                window.history.replaceState(null, "", "/candidate/verify-email");
            }
        } catch {
            setMessage("I couldn't verify your email. Check your connection and try again.");
            setOutcome("failed");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="candidate-account-panel candidate-account-panel--message" aria-labelledby="verify-email-title">
            <span className={`candidate-account-panel__status${outcome === "failed" ? " is-error" : ""}`} aria-hidden="true">
                {outcome === "verified"
                    ? <CheckCircle2 size={24} />
                    : outcome === "failed"
                        ? <AlertCircle size={24} />
                        : <MailCheck size={24} />}
            </span>
            <p className="type-eyebrow">Account verification</p>
            <h1 id="verify-email-title">
                {outcome === "verified" ? "Email verified." : "Verify your email."}
            </h1>
            <p role="status">{message}</p>

            {outcome === "ready" ? (
                <button
                    type="button"
                    className="candidate-account-submit"
                    onClick={verify}
                    disabled={submitting}
                >
                    {submitting ? <Loader2 className="candidate-account-spin" size={19} /> : null}
                    {submitting ? "Verifying" : "Verify email"}
                    {!submitting ? <ArrowRight size={19} /> : null}
                </button>
            ) : null}

            {outcome === "verified" ? (
                <Link href="/candidate/login" className="candidate-account-primary-link">
                    Continue to sign in
                    <ArrowRight size={18} />
                </Link>
            ) : null}

            {outcome === "failed" ? (
                <div className="candidate-account-panel__resend">
                    <h2>Send a new link</h2>
                    <CandidateVerificationResend />
                </div>
            ) : null}
        </section>
    );
}
