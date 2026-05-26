import { NextResponse, type NextRequest } from "next/server";
import { e2eRecruiterCookie, isServerE2EMode } from "@/lib/e2e/test-mode";
import { Logger } from "@/lib/logger";
import { getAppSessionCookieName } from "@/lib/server/auth/app-session-cookie";
import { defaultCandidateLoginNext, resolveCandidateLoginNext } from "@/lib/server/candidate-login-intent";
import { getCandidateRuntimeConfig } from "@/lib/server/candidate/candidate-runtime-config";

const PROTECTED_APP_PAGE_PREFIXES = [
    "/recruiter",
    "/admin",
    "/qa",
];
const PROTECTED_CANDIDATE_PAGE_PREFIXES = [
    "/practice",
    "/dashboard",
    "/settings",
    "/session",
    "/summary",
];

export function updateSession(request: NextRequest) {
    const start = Date.now();
    const protectedCandidatePage = isProtectedCandidatePage(request.nextUrl.pathname);
    if (protectedCandidatePage) {
        const { authMode } = getCandidateRuntimeConfig();
        if (authMode === "external") {
            const denialReason = "missing_candidate_session";
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = "/auth/talentarbor/start";
            loginUrl.search = "";
            loginUrl.searchParams.set(
                "next",
                resolveCandidateLoginNext(request.nextUrl.pathname) || defaultCandidateLoginNext
            );

            Logger.info("Candidate auth middleware redirected unauthenticated request", {
                route: request.nextUrl.pathname,
                actorMode: authMode,
                actorType: "candidate",
                durationMs: Date.now() - start,
                method: request.method,
                outcome: "redirect_to_candidate_login",
                reason: denialReason,
            }, "CandidateAuthMiddleware");

            return NextResponse.redirect(loginUrl);
        }

        Logger.info("Candidate auth middleware request processed", {
            route: request.nextUrl.pathname,
            actorType: "candidate",
            authMode,
            durationMs: Date.now() - start,
            method: request.method,
            outcome: "allowed_local_candidate_mode",
        }, "CandidateAuthMiddleware");

        return NextResponse.next({ request });
    }

    const protectedPage = isProtectedAppPage(request.nextUrl.pathname);
    const hasAppSession = Boolean(request.cookies.get(getAppSessionCookieName())?.value);
    const hasE2ESession = isServerE2EMode()
        && request.cookies.get(e2eRecruiterCookie.name)?.value === e2eRecruiterCookie.value;

    if (protectedPage && !hasAppSession && !hasE2ESession) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.search = "";
        loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

        Logger.info("App auth middleware redirected unauthenticated request", {
            route: request.nextUrl.pathname,
            actorType: "anonymous",
            durationMs: Date.now() - start,
            method: request.method,
            outcome: "redirect_to_login",
        }, "AppAuthMiddleware");

        return NextResponse.redirect(loginUrl);
    }

    if (protectedPage) {
        Logger.info("App auth middleware request processed", {
            route: request.nextUrl.pathname,
            actorType: "recruiter",
            durationMs: Date.now() - start,
            method: request.method,
            outcome: "allowed",
        }, "AppAuthMiddleware");
    }

    return NextResponse.next({ request });
}

function isProtectedAppPage(pathname: string) {
    return PROTECTED_APP_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedCandidatePage(pathname: string) {
    return PROTECTED_CANDIDATE_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
