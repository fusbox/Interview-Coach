"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";

import { CandidateVerificationResend } from "./CandidateVerificationResend";

export function CandidateLoginExperience({ nextTarget }: { nextTarget: string }) {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showResend, setShowResend] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch("/candidate/account/login", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const result = await response.json().catch(() => ({})) as { message?: string };
            if (!response.ok) {
                throw new Error(result.message ?? "Sign in failed.");
            }
            router.replace(nextTarget);
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Sign in failed.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="candidate-account-entry candidate-account-entry--login" aria-labelledby="candidate-login-title">
            <header className="candidate-account-entry__intro">
                <p className="type-eyebrow">Candidate access</p>
                <h1 id="candidate-login-title">Welcome back.</h1>
                <p>Sign in to continue your interview practice.</p>
            </header>

            <div className="candidate-account-panel candidate-account-panel--login">
                <form className="candidate-account-form candidate-account-form--login" onSubmit={handleSubmit} aria-busy={submitting}>
                    {error ? (
                        <div className="candidate-account-alert" role="alert">
                            <AlertCircle size={18} aria-hidden="true" />
                            <span>{error}</span>
                        </div>
                    ) : null}
                    <div className="candidate-account-field">
                        <label htmlFor="candidate-login-email">Email</label>
                        <input
                            id="candidate-login-email"
                            type="email"
                            autoComplete="username"
                            inputMode="email"
                            required
                            maxLength={320}
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>
                    <div className="candidate-account-field">
                        <div className="candidate-account-field__label-row">
                            <label htmlFor="candidate-login-password">Password</label>
                            <Link href="/candidate/forgot-password">Forgot password?</Link>
                        </div>
                        <span className="candidate-account-password">
                            <input
                                id="candidate-login-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
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
                    <button type="submit" className="candidate-account-submit" disabled={submitting}>
                        {submitting ? <Loader2 className="candidate-account-spin" size={19} /> : null}
                        {submitting ? "Signing in" : "Sign in"}
                        {!submitting ? <ArrowRight size={19} /> : null}
                    </button>
                </form>

                <div className="candidate-account-panel__support">
                    <button
                        type="button"
                        aria-expanded={showResend}
                        onClick={() => setShowResend((value) => !value)}
                    >
                        <span>Need a new verification email?</span>
                        <ChevronDown
                            className={showResend ? "is-open" : undefined}
                            size={17}
                            aria-hidden="true"
                        />
                    </button>
                    {showResend ? <CandidateVerificationResend initialEmail={email} /> : null}
                </div>
            </div>

            <p className="candidate-account-panel__switch">
                New to Interview Coach? <Link href="/candidate/register">Create an account</Link>
            </p>
        </section>
    );
}
