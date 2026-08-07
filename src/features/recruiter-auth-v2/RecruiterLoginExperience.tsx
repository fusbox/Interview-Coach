"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

import { useNavigationHandoff } from "@/components/ui/use-navigation-handoff";

export function RecruiterLoginExperience({ nextTarget }: { nextTarget: string }) {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { pending: submitting, claim, release } = useNavigationHandoff();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!claim()) return;
        setError(null);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(typeof result.message === "string" ? result.message : "Sign in failed.");
            }
            router.replace(nextTarget);
            router.refresh();
        } catch (cause) {
            release();
            setError(cause instanceof Error ? cause.message : "Sign in failed.");
        }
    }

    return (
        <section className="candidate-account-entry candidate-account-entry--login" aria-labelledby="recruiter-login-title">
            <header className="candidate-account-entry__intro">
                <p className="type-eyebrow">Recruiter access</p>
                <h1 id="recruiter-login-title">Welcome back.</h1>
                <p>Sign in to continue to the recruiter workspace.</p>
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
                        <label htmlFor="recruiter-email">Email</label>
                        <input
                            id="recruiter-email"
                            name="email"
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
                        <label htmlFor="recruiter-password">Password</label>
                        <span className="candidate-account-password">
                            <input
                                id="recruiter-password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                maxLength={1024}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((visible) => !visible)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                aria-pressed={showPassword}
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
            </div>
        </section>
    );
}
