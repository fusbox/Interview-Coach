"use client";

import Link from "next/link";
import { FormEvent, type InputHTMLAttributes, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { CANDIDATE_POLICY_LINKS } from "./candidate-policy-manifest";

type RegistrationResponse = {
    message?: string;
    developmentVerificationUrl?: string;
};

const emptyContactPreferences = {
    email: false,
    sms: false,
    phone: false,
};

export function CandidateRegistrationExperience() {
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [developmentUrl, setDevelopmentUrl] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [contactPreferences, setContactPreferences] = useState(emptyContactPreferences);
    const hasContactPreference = useMemo(
        () => Object.values(contactPreferences).some(Boolean),
        [contactPreferences],
    );

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const form = new FormData(event.currentTarget);
        const password = String(form.get("password") ?? "");
        const confirmPassword = String(form.get("confirmPassword") ?? "");
        if (password !== confirmPassword) {
            setError("The passwords do not match.");
            return;
        }
        const contactAuthorization = form.get("contactAuthorization") === "on";
        if (hasContactPreference !== contactAuthorization) {
            setError(hasContactPreference
                ? "Confirm contact authorization for the methods you selected."
                : "Choose at least one contact method or leave contact authorization unchecked.");
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch("/candidate/account/register", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    firstName: form.get("firstName"),
                    lastName: form.get("lastName"),
                    email: form.get("email"),
                    password,
                    phone: form.get("phone"),
                    postalCode: form.get("postalCode"),
                    contactPreferences,
                    contactAuthorization,
                    platformPolicyAccepted: form.get("platformPolicyAccepted") === "on",
                    responsibleAiAcknowledged: form.get("responsibleAiAcknowledged") === "on",
                }),
            });
            const result = await response.json().catch(() => ({})) as RegistrationResponse;
            if (!response.ok) {
                throw new Error(result.message ?? "I couldn't create your account. Try again.");
            }
            setDevelopmentUrl(result.developmentVerificationUrl ?? null);
            setCompleted(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "I couldn't create your account. Try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (completed) {
        return (
            <section className="candidate-account-panel candidate-account-panel--message" aria-labelledby="registration-complete">
                <span className="candidate-account-panel__status" aria-hidden="true">
                    <CheckCircle2 size={24} />
                </span>
                <p className="type-eyebrow">One more step</p>
                <h1 id="registration-complete">Check your email.</h1>
                <p>
                    If this address can be registered, I sent a verification link. Verify your email before signing in.
                    If it does not arrive, request another from the sign-in page.
                </p>
                {developmentUrl ? (
                    <a href={developmentUrl} className="candidate-account-primary-link">
                        Open development verification link
                        <ArrowRight size={18} />
                    </a>
                ) : null}
                <Link href="/candidate/login" className="candidate-account-secondary-link">
                    Go to sign in
                </Link>
            </section>
        );
    }

    return (
        <section className="candidate-account-entry candidate-account-entry--registration" aria-labelledby="candidate-register-title">
            <header className="candidate-account-entry__intro">
                <p className="type-eyebrow">Candidate account</p>
                <h1 id="candidate-register-title">Create your Interview Coach account.</h1>
                <p>Your account connects your practice, coaching, and progress across devices.</p>
            </header>

            <form className="candidate-account-form candidate-account-form--registration" onSubmit={handleSubmit} aria-busy={submitting}>
                {error ? (
                    <div className="candidate-account-alert" role="alert">
                        <AlertCircle size={18} aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                ) : null}

                <fieldset className="candidate-account-form__section">
                    <legend className="type-eyebrow">About you</legend>
                    <div className="candidate-account-form__grid">
                        <Field label="First name" name="firstName" autoComplete="given-name" />
                        <Field label="Last name" name="lastName" autoComplete="family-name" />
                        <Field
                            label="Email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            wide
                        />
                        <Field
                            label="Phone"
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            placeholder="(555) 555-5555"
                        />
                        <Field
                            label="ZIP code"
                            name="postalCode"
                            autoComplete="postal-code"
                            inputMode="numeric"
                            pattern="[0-9]{5}(-[0-9]{4})?"
                        />
                    </div>
                </fieldset>

                <fieldset className="candidate-account-form__section">
                    <legend className="type-eyebrow">Secure your account</legend>
                    <div className="candidate-account-form__grid">
                        <PasswordField
                            label="Password"
                            name="password"
                            visible={showPassword}
                            toggle={() => setShowPassword((value) => !value)}
                        />
                        <Field
                            label="Confirm password"
                            name="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            minLength={12}
                            maxLength={128}
                        />
                    </div>
                </fieldset>

                <fieldset className="candidate-account-form__section">
                    <legend className="type-eyebrow">Contact preferences</legend>
                    <p className="candidate-account-form__section-copy">
                        Optional. Choose how TalentArbor may share job opportunities and platform updates.
                    </p>
                    <div className="candidate-account-choice-grid">
                        {([
                            ["email", "Email"],
                            ["sms", "Text message"],
                            ["phone", "Phone call"],
                        ] as const).map(([channel, label]) => (
                            <label key={channel} className="candidate-account-choice">
                                <input
                                    type="checkbox"
                                    checked={contactPreferences[channel]}
                                    onChange={(event) => setContactPreferences((current) => ({
                                        ...current,
                                        [channel]: event.target.checked,
                                    }))}
                                />
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                    {hasContactPreference ? (
                        <label className="candidate-account-consent">
                            <input name="contactAuthorization" type="checkbox" required />
                            <span>
                                I agree to receive job opportunities and TalentArbor updates through the methods I
                                selected. I can change this later.
                            </span>
                        </label>
                    ) : null}
                </fieldset>

                <fieldset className="candidate-account-form__section">
                    <legend className="type-eyebrow">Platform terms</legend>
                    <label className="candidate-account-consent">
                        <input name="platformPolicyAccepted" type="checkbox" required />
                        <span>
                            I agree to the{" "}
                            <a href={CANDIDATE_POLICY_LINKS.terms}>Terms of Use</a>
                            {" "}and acknowledge the{" "}
                            <a href={CANDIDATE_POLICY_LINKS.privacy}>Privacy Policy</a>
                            {" "}and{" "}
                            <a href={CANDIDATE_POLICY_LINKS.cookie}>Cookie Policy</a>.
                        </span>
                    </label>
                    <label className="candidate-account-consent">
                        <input name="responsibleAiAcknowledged" type="checkbox" required />
                        <span>
                            I understand Interview Coach uses AI for candidate-led practice and is not used to make
                            hiring decisions. Read the{" "}
                            <a href={CANDIDATE_POLICY_LINKS.responsibleAi}>Responsible AI Statement</a>.
                        </span>
                    </label>
                </fieldset>

                <div className="candidate-account-form__actions">
                    <button type="submit" className="candidate-account-submit" disabled={submitting}>
                        {submitting ? <Loader2 className="candidate-account-spin" size={19} /> : null}
                        {submitting ? "Creating account" : "Create account"}
                        {!submitting ? <ArrowRight size={19} /> : null}
                    </button>
                </div>
            </form>

            <p className="candidate-account-panel__switch">
                Already have an account? <Link href="/candidate/login">Sign in</Link>
            </p>
        </section>
    );
}

function Field({
    label,
    name,
    type = "text",
    helper,
    wide = false,
    ...inputProps
}: {
    label: string;
    name: string;
    type?: string;
    helper?: string;
    wide?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
    return (
        <div className={`candidate-account-field${wide ? " candidate-account-field--wide" : ""}`}>
            <label htmlFor={`candidate-register-${name}`}>{label}</label>
            <input
                id={`candidate-register-${name}`}
                name={name}
                type={type}
                required
                maxLength={inputProps.maxLength ?? 320}
                {...inputProps}
            />
            {helper ? <small>{helper}</small> : null}
        </div>
    );
}

function PasswordField({
    label,
    name,
    visible,
    toggle,
}: {
    label: string;
    name: string;
    visible: boolean;
    toggle: () => void;
}) {
    return (
        <div className="candidate-account-field">
            <label htmlFor={`candidate-register-${name}`}>{label}</label>
            <span className="candidate-account-password">
                <input
                    id={`candidate-register-${name}`}
                    name={name}
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    placeholder="At least 12 characters"
                    required
                />
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={visible ? "Hide password" : "Show password"}
                    title={visible ? "Hide password" : "Show password"}
                >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </span>
        </div>
    );
}
