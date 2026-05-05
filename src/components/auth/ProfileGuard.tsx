"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isClientE2EMode } from "@/lib/e2e/test-mode";

export function ProfileGuard() {
    const router = useRouter();
    const pathname = usePathname();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (isClientE2EMode()) {
            setChecked(true);
            return;
        }

        // Skip if already on settings page to avoid loop
        if (pathname?.includes('/recruiter/settings')) {
            return;
        }

        const checkProfile = async () => {
            const response = await fetch("/api/recruiter/profile", { cache: "no-store" });

            if (response.status === 401) return;
            if (!response.ok) {
                setChecked(true);
                return;
            }

            const data = await response.json();
            if (!data.profileExists) {
                router.push('/recruiter/settings?tour=recruiter-create-invite');
            }
            setChecked(true);
        };

        if (!checked) {
            checkProfile();
        }
    }, [pathname, router, checked]);

    // This component renders nothing, just logic
    return null;
}
