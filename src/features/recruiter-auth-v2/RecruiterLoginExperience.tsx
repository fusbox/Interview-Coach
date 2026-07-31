"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecruiterLoginExperience({ nextTarget }: { nextTarget: string }) {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
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
            setError(cause instanceof Error ? cause.message : "Sign in failed.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="recruiter-login-page">
            <header className="recruiter-login-page__header">
                <Link href="/" aria-label="NJ Career Interview Coach home">
                    <Image
                        src="/njcareer-logo.png"
                        alt="NJ Career"
                        width={520}
                        height={120}
                        className="recruiter-login-page__logo"
                        priority
                        unoptimized
                    />
                </Link>
            </header>

            <section className="recruiter-login-panel" aria-labelledby="recruiter-login-title">
                <div className="recruiter-login-panel__intro">
                    <p className="type-eyebrow">Employee access</p>
                    <h1 id="recruiter-login-title">Sign in to Interview Coach</h1>
                    <p>Use your employee account to continue to the recruiter workspace.</p>
                </div>

                <form onSubmit={handleSubmit} aria-busy={submitting}>
                    {error ? (
                        <div className="recruiter-login-error" role="alert">
                            <AlertCircle size={18} aria-hidden="true" />
                            <span>{error}</span>
                        </div>
                    ) : null}

                    <div className="recruiter-login-field">
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

                    <div className="recruiter-login-field">
                        <label htmlFor="recruiter-password">Password</label>
                        <div className="recruiter-login-field__password">
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
                        </div>
                    </div>

                    <Button
                        type="submit"
                        emphasis="primary"
                        density="comfortable"
                        shape="app"
                        label="strong"
                        className="recruiter-login-panel__submit"
                        disabled={submitting}
                    >
                        {submitting ? <Loader2 className="recruiter-spin" size={18} /> : <LogIn size={18} />}
                        {submitting ? "Signing in" : "Sign in"}
                    </Button>
                </form>
            </section>
        </main>
    );
}
