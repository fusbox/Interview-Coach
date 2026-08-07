"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationHandoff } from "@/components/ui/use-navigation-handoff";

export function RecruiterLogoutButton({ navigate = replaceDocument }: {
    navigate?: (target: string) => void;
} = {}) {
    const { pending: submitting, claim, release } = useNavigationHandoff();

    async function logout() {
        if (!claim()) return;
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
            });
            if (!response.ok) throw new Error("Sign out failed.");
            navigate("/login");
        } catch {
            release();
        }
    }

    return (
        <Button
            type="button"
            emphasis="secondary"
            density="compact"
            shape="pill"
            onClick={logout}
            disabled={submitting}
            loading={submitting}
        >
            <LogOut size={16} />
            {submitting ? "Signing out" : "Sign out"}
        </Button>
    );
}

function replaceDocument(target: string) {
    window.location.replace(target);
}
