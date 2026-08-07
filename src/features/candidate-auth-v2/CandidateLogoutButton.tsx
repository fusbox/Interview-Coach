"use client";

import { useState } from "react";
import { AlertCircle, Loader2, LogOut } from "lucide-react";

import { useNavigationHandoff } from "@/components/ui/use-navigation-handoff";

export function CandidateLogoutButton({
    className,
    iconOnly = false,
    navigate = assignDocument,
}: {
    className?: string;
    iconOnly?: boolean;
    navigate?: (target: string) => void;
}) {
    const [failed, setFailed] = useState(false);
    const { pending: submitting, claim, release } = useNavigationHandoff();

    async function signOut() {
        if (!claim()) return;
        setFailed(false);
        try {
            const response = await fetch("/candidate/account/logout", {
                method: "POST",
                credentials: "same-origin",
            });
            if (!response.ok) throw new Error("Sign out failed.");
            navigate("/candidate/login");
        } catch {
            release();
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
            aria-busy={submitting}
            aria-label={iconOnly ? accessibleLabel : undefined}
            title={iconOnly ? accessibleLabel : undefined}
        >
            {submitting ? (
                <Loader2 className="candidate-account-spin" size={18} aria-hidden="true" />
            ) : failed ? (
                <AlertCircle size={18} aria-hidden="true" />
            ) : (
                <LogOut size={18} aria-hidden="true" />
            )}
            {!iconOnly ? accessibleLabel : null}
            {iconOnly && failed ? <span className="sr-only" role="alert">Sign out failed. Try again.</span> : null}
        </button>
    );
}

function assignDocument(target: string) {
    window.location.assign(target);
}
