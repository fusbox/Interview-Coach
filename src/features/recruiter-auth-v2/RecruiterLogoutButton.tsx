"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecruiterLogoutButton() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    async function logout() {
        setSubmitting(true);
        try {
            const response = await fetch("/api/auth/logout", { method: "POST" });
            if (!response.ok) return;
            router.replace("/login");
            router.refresh();
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
