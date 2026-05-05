import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Logger } from '@/lib/logger'
import { getAppAuthBackendName } from '@/lib/server/auth/app-auth';

export async function updateSession(request: NextRequest) {
    const isRecruiter = request.nextUrl.pathname.startsWith('/recruiter');
    const start = Date.now();

    if (getAppAuthBackendName() === "postgres") {
        const response = NextResponse.next({ request });
        if (isRecruiter) {
            Logger.info("Recruiter middleware request processed", {
                route: request.nextUrl.pathname,
                actorType: 'recruiter',
                durationMs: Date.now() - start,
                method: request.method
            }, "AppAuthMiddleware");
        }

        return response;
    }

    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, {
                            ...options,
                            secure: process.env.NODE_ENV === 'production',
                        })
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // Optimization: Skip getUser if no Supabase cookies are present
    // This avoids unnecessary network calls on public pages for unauthenticated users
    const hasAuthCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-'));

    if (hasAuthCookie) {
        await supabase.auth.getUser();
    }

    if (isRecruiter) {
        Logger.info("Recruiter middleware request processed", {
            route: request.nextUrl.pathname,
            actorType: 'recruiter',
            durationMs: Date.now() - start,
            method: request.method
        }, "SupabaseMiddleware");
    }

    return supabaseResponse
}
