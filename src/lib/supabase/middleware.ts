import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Logger } from '@/lib/logger'
import { e2eRecruiterCookie, isServerE2EMode } from '@/lib/e2e/test-mode';
import { getAppAuthBackendName } from '@/lib/server/auth/app-auth-config';
import { getAppSessionCookieName } from '@/lib/server/auth/app-session-cookie';

const PROTECTED_APP_PAGE_PREFIXES = [
    '/recruiter',
    '/admin',
    '/qa',
];

export async function updateSession(request: NextRequest) {
    const isRecruiter = request.nextUrl.pathname.startsWith('/recruiter');
    const start = Date.now();

    if (getAppAuthBackendName() === "postgres") {
        return updateAppAuthSession(request, start);
    }

    return updateSupabaseSession(request, isRecruiter, start);
}

function updateAppAuthSession(request: NextRequest, start: number) {
    const protectedPage = isProtectedAppPage(request.nextUrl.pathname);
    const hasAppSession = Boolean(request.cookies.get(getAppSessionCookieName())?.value);
    const hasE2ESession = isServerE2EMode()
        && request.cookies.get(e2eRecruiterCookie.name)?.value === e2eRecruiterCookie.value;

    if (protectedPage && !hasAppSession && !hasE2ESession) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.search = '';
        loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);

        Logger.info("App auth middleware redirected unauthenticated request", {
            route: request.nextUrl.pathname,
            actorType: 'anonymous',
            durationMs: Date.now() - start,
            method: request.method,
            outcome: 'redirect_to_login',
        }, "AppAuthMiddleware");

        return NextResponse.redirect(loginUrl);
    }

    if (protectedPage) {
        Logger.info("App auth middleware request processed", {
            route: request.nextUrl.pathname,
            actorType: 'recruiter',
            durationMs: Date.now() - start,
            method: request.method,
            outcome: 'allowed',
        }, "AppAuthMiddleware");
    }

    return NextResponse.next({ request });
}

function isProtectedAppPage(pathname: string) {
    return PROTECTED_APP_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function updateSupabaseSession(request: NextRequest, isRecruiter: boolean, start: number) {
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
