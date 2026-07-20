"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecruiterLogoutButton({ navigate = replaceDocument }: {
    navigate?: (target: string) => void;
} = {}) {
    const [submitting, setSubmitting] = useState(false);

    async function logout() {
        setSubmitting(true);
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
            });
            if (!response.ok) return;
            navigate("/login");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Button
            type="button"
            emphasis="secondary"
            density="compact"
            shape="app"
            onClick={logout}
            disabled={submitting}
        >
            {submitting ? <Loader2 className="recruiter-spin" size={16} /> : <LogOut size={16} />}
            {submitting ? "Signing out" : "Sign out"}
        </Button>
    );
}

function replaceDocument(target: string) {
    window.location.replace(target);
}
