"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, usePathname } from "next/navigation";

export function ProfileGuard() {
    const router = useRouter();
    const pathname = usePathname();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        // Skip if already on settings page to avoid loop
        if (pathname?.includes('/recruiter/settings')) {
            return;
        }

        const checkProfile = async () => {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return; // Auth guard likely handles this, or public route

            // Check if profile exists
            const { data, error } = await supabase
                .from('recruiter_profiles')
                .select('recruiter_id')
                .eq('recruiter_id', user.id)
                .single();

            if (error?.code === 'PGRST116' || !data) {
                router.push('/recruiter/settings');
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
