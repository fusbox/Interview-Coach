import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react';
import { getRequiredServerEnv } from '@/lib/server/config/server-env';
import { getE2ERecruiterUser, hasE2ERecruiterCookie, isServerE2EMode } from '@/lib/e2e/test-mode';

export function createClient() {
    return createServerClient(
        getRequiredServerEnv("NEXT_PUBLIC_SUPABASE_URL", "server Supabase client"),
        getRequiredServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "server Supabase client"),
        {
            cookies: {
                async getAll() {
                    const cookieStore = await cookies()
                    return cookieStore.getAll()
                },
                async setAll(cookiesToSet) {
                    try {
                        const cookieStore = await cookies()
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, {
                                ...options,
                                secure: process.env.NODE_ENV === 'production',
                            })
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

export function createAdminClient() {
    return createServerClient(
        getRequiredServerEnv("NEXT_PUBLIC_SUPABASE_URL", "admin Supabase client"),
        getRequiredServerEnv("SUPABASE_SERVICE_ROLE_KEY", "admin Supabase client"),
        {
            cookies: {
                getAll() {
                    return []
                },
                setAll() {
                }
            }
        }
    )
}

export const getCachedUser = cache(async () => {
    if (isServerE2EMode()) {
        const cookieStore = await cookies();

        if (hasE2ERecruiterCookie(cookieStore)) {
            return getE2ERecruiterUser();
        }
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
});
