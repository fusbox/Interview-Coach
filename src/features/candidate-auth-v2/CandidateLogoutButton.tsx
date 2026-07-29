"use client";

import { useState } from "react";
import { AlertCircle, LogOut } from "lucide-react";

export function CandidateLogoutButton({
    className,
    iconOnly = false,
}: {
    className?: string;
    iconOnly?: boolean;
}) {
    const [submitting, setSubmitting] = useState(false);
    const [failed, setFailed] = useState(false);

    async function signOut() {
        setSubmitting(true);
        setFailed(false);
        try {
            const response = await fetch("/candidate/account/logout", {
                method: "POST",
                credentials: "same-origin",
            });
            if (!response.ok) throw new Error("Sign out failed.");
            window.location.assign("/candidate/login");
        } catch {
            setSubmitting(false);
            setFailed(true);
        }
    }

    const accessibleLabel = submitting
        ? "Signing out"
        : failed
            ? "Sign out failed. Try again"
            : "Sign out";

    return (
        <button
            type="button"
            className={`${className ?? ""}${failed ? " is-error" : ""}`.trim()}
            onClick={signOut}
            disabled={submitting}
            aria-label={iconOnly ? accessibleLabel : undefined}
            title={iconOnly ? accessibleLabel : undefined}
        >
            {failed ? <AlertCircle size={18} aria-hidden="true" /> : <LogOut size={18} aria-hidden="true" />}
            {!iconOnly ? accessibleLabel : null}
            {iconOnly && failed ? <span className="sr-only" role="alert">Sign out failed. Try again.</span> : null}
        </button>
    );
}
