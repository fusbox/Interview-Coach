"use client";

import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    normalizeRecruiterDisplayName,
    type RecruiterSettings,
} from "./recruiter-settings-contract";

export function RecruiterSettingsExperience({ initialSettings }: {
    initialSettings: RecruiterSettings;
}) {
    const router = useRouter();
    const [savedSettings, setSavedSettings] = useState(initialSettings);
    const [senderDisplayName, setSenderDisplayName] = useState(initialSettings.senderDisplayName);
    const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [error, setError] = useState("");
    const normalizedDisplayName = useMemo(
        () => normalizeRecruiterDisplayName(senderDisplayName),
        [senderDisplayName],
    );
    const isValid = Boolean(normalizedDisplayName);
    const isDirty = isValid && normalizedDisplayName !== savedSettings.senderDisplayName;

    async function saveSettings(event: React.FormEvent) {
        event.preventDefault();
        if (!isDirty || status === "saving") return;
        setStatus("saving");
        setError("");

        try {
            const response = await fetch("/api/recruiter/profile", {
                method: "PUT",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    senderDisplayName: normalizedDisplayName,
                    revision: savedSettings.revision,
                }),
            });
            const body = await response.json().catch(() => null) as {
                message?: string;
                settings?: RecruiterSettings;
            } | null;
            if (!response.ok || !body?.settings) {
                throw new Error(body?.message ?? "Settings could not be saved. Try again.");
            }
            setSavedSettings(body.settings);
            setSenderDisplayName(body.settings.senderDisplayName);
            setStatus("saved");
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Settings could not be saved. Try again.");
            setStatus("idle");
        }
    }

    function updateDisplayName(value: string) {
        setSenderDisplayName(value);
        setStatus("idle");
        setError("");
    }

    return (
        <main className="recruiter-workspace recruiter-settings-page">
            <header className="recruiter-settings-intro">
                <div>
                    <p className="type-eyebrow">Account</p>
                    <h1>Invitation identity</h1>
                    <p>Choose the name candidates see in invitations you send or copy from Interview Coach.</p>
                </div>
                <Link href="/recruiter/dashboard" className="recruiter-settings-back">
                    <ArrowLeft size={17} aria-hidden="true" />
                    Dashboard
                </Link>
            </header>

            <form className="recruiter-settings-form" onSubmit={saveSettings} noValidate>
                <section className="recruiter-settings-panel" aria-labelledby="invitation-identity-title">
                    <div className="recruiter-settings-panel__heading">
                        <p className="type-eyebrow">Candidate-facing details</p>
                        <h2 id="invitation-identity-title">Name shown to candidates</h2>
                    </div>

                    <div className="recruiter-settings-field">
                        <label htmlFor="sender-display-name">Display name</label>
                        <input
                            id="sender-display-name"
                            name="senderDisplayName"
                            autoComplete="name"
                            value={senderDisplayName}
                            onChange={(event) => updateDisplayName(event.target.value)}
                            aria-invalid={senderDisplayName.length > 0 && !isValid}
                            aria-describedby="sender-display-name-hint"
                            required
                        />
                        <small id="sender-display-name-hint">
                            Used in invitation messages created after you save.
                        </small>
                    </div>

                    <div className="recruiter-settings-account-email">
                        <span>Account email</span>
                        <strong>{savedSettings.email}</strong>
                        <small>Managed as part of your sign-in account.</small>
                    </div>

                    <div className="recruiter-settings-actions">
                        <div aria-live="polite">
                            {error ? <p className="recruiter-settings-message is-error">{error}</p> : null}
                            {status === "saved" && !isDirty ? (
                                <p className="recruiter-settings-message is-success">
                                    <CheckCircle2 size={17} aria-hidden="true" /> Settings saved
                                </p>
                            ) : null}
                        </div>
                        <Button
                            type="submit"
                            emphasis="primary"
                            density="comfortable"
                            shape="app"
                            disabled={!isDirty || status === "saving"}
                        >
                            {status === "saving" ? (
                                <Loader2 className="recruiter-spin" size={17} aria-hidden="true" />
                            ) : (
                                <Save size={17} aria-hidden="true" />
                            )}
                            {status === "saving" ? "Saving" : "Save changes"}
                        </Button>
                    </div>
                </section>
            </form>
        </main>
    );
}
