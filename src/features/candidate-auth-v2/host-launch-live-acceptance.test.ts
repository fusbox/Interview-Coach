// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
    inspectCandidateHostLaunchAcceptance,
} from "./host-launch-live-acceptance";

const requestId1 = "11111111-1111-4111-8111-111111111111";
const requestId2 = "22222222-2222-4222-8222-222222222222";
const token = "signed.single-use.token";
const cookieValue = "opaque-launch-session";

describe("candidate host launch live acceptance probe", () => {
    it("accepts a clean HTTPS setup exchange without retaining credential values", async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(exchangeResponse({
                location: "/candidate/setup",
                requestId: requestId1,
                cookie: sessionCookie(),
            }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }));

        const report = await inspectCandidateHostLaunchAcceptance({
            caseId: "identity-new",
            launchUrl: launchUrl(),
            fetchImpl,
        });

        expect(report).toMatchObject({
            passed: true,
            expectedOutcome: "accepted",
            requiresDiagnosticCorrelation: false,
            firstExchange: {
                status: 302,
                requestId: requestId1,
                route: "setup",
                sameOriginRedirect: true,
                redirectHasQuery: false,
                cacheControlNoStore: true,
                referrerPolicyNoReferrer: true,
                sessionCookie: {
                    present: true,
                    httpOnly: true,
                    sameSiteLax: true,
                    candidatePath: true,
                    hasExpiry: true,
                    secure: true,
                },
            },
            destination: {
                status: 200,
                route: "setup",
                reachable: true,
            },
            failures: [],
        });
        expect(fetchImpl).toHaveBeenCalledTimes(2);

        const serialized = JSON.stringify(report);
        expect(serialized).not.toContain(token);
        expect(serialized).not.toContain(cookieValue);
        expect(serialized).not.toContain("candidate@example.com");
    });

    it("reports a metadata-only rejection that requires server diagnostic correlation", async () => {
        const report = await inspectCandidateHostLaunchAcceptance({
            caseId: "wrong-issuer",
            launchUrl: launchUrl(),
            fetchImpl: vi.fn(async () => exchangeResponse({
                location: "/candidate/dashboard",
                requestId: requestId1,
            })),
        });

        expect(report).toMatchObject({
            passed: true,
            expectedOutcome: "rejected",
            requiresDiagnosticCorrelation: true,
            firstExchange: {
                route: "dashboard",
                sessionCookie: { present: false },
            },
            destination: null,
            failures: [],
        });
    });

    it("proves a fresh setup token is accepted once and rejected on immediate replay", async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(exchangeResponse({
                location: "/candidate/setup",
                requestId: requestId1,
                cookie: sessionCookie(),
            }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }))
            .mockResolvedValueOnce(exchangeResponse({
                location: "/candidate/dashboard",
                requestId: requestId2,
            }));

        const report = await inspectCandidateHostLaunchAcceptance({
            caseId: "replay-setup",
            launchUrl: launchUrl(),
            fetchImpl,
        });

        expect(report).toMatchObject({
            passed: true,
            requiresDiagnosticCorrelation: true,
            replayExchange: {
                status: 302,
                requestId: requestId2,
                route: "dashboard",
                sessionCookie: { present: false },
            },
            failures: [],
        });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it("fails when an accepted HTTPS exchange omits secure cookie or privacy headers", async () => {
        const report = await inspectCandidateHostLaunchAcceptance({
            caseId: "job-owned",
            launchUrl: launchUrl(),
            fetchImpl: vi.fn(async () => new Response(null, {
                status: 302,
                headers: {
                    Location: "/candidate/setup?token=leaked",
                    "Set-Cookie": `ic_candidate_launch_session=${cookieValue}; Path=/; SameSite=Lax`,
                },
            })),
        });

        expect(report.passed).toBe(false);
        expect(report.failures).toEqual(expect.arrayContaining([
            "missing_request_id",
            "cache_control_not_no_store",
            "referrer_policy_not_no_referrer",
            "redirect_contains_query",
            "session_cookie_missing_http_only",
            "session_cookie_wrong_path",
            "session_cookie_missing_expiry",
            "session_cookie_missing_secure",
        ]));
        expect(JSON.stringify(report)).not.toContain("leaked");
        expect(JSON.stringify(report)).not.toContain(cookieValue);
    });

    it.each([
        ["http deployment", "http://staging.example.com/candidate/launch?token=signed", false, "https_required"],
        ["wrong path", "https://staging.example.com/candidate/setup?token=signed", false, "invalid_launch_path"],
        ["missing token", "https://staging.example.com/candidate/launch", false, "invalid_launch_query"],
        ["unsigned next", "https://staging.example.com/candidate/launch?token=signed&next=/candidate/setup", false, "invalid_launch_query"],
        ["fragment", "https://staging.example.com/candidate/launch?token=signed#token", false, "invalid_launch_url"],
    ])("rejects unsafe input: %s", async (_label, candidateUrl, allowLocalHttp, code) => {
        await expect(inspectCandidateHostLaunchAcceptance({
            caseId: "identity-new",
            launchUrl: candidateUrl,
            allowLocalHttp,
            fetchImpl: vi.fn(),
        })).rejects.toMatchObject({ code });
    });

    it("permits explicit localhost HTTP without treating it as HTTPS evidence", async () => {
        const report = await inspectCandidateHostLaunchAcceptance({
            caseId: "identity-new",
            launchUrl: `http://localhost:3000/candidate/launch?token=${token}`,
            allowLocalHttp: true,
            fetchImpl: vi.fn()
                .mockResolvedValueOnce(exchangeResponse({
                    location: "/candidate/setup",
                    requestId: requestId1,
                    cookie: sessionCookie({ secure: false }),
                }))
                .mockResolvedValueOnce(new Response(null, { status: 200 })),
        });

        expect(report.passed).toBe(true);
        expect(report.target.protocol).toBe("http-local");
        expect(report.firstExchange.sessionCookie.secure).toBe(false);
    });

    it("converts transport failures into a bounded failure code", async () => {
        const report = await inspectCandidateHostLaunchAcceptance({
            caseId: "identity-returning",
            launchUrl: launchUrl(),
            fetchImpl: vi.fn(async () => {
                throw new Error(`network failed for ${token}`);
            }),
        });

        expect(report).toMatchObject({
            passed: false,
            failures: ["network_error"],
        });
        expect(JSON.stringify(report)).not.toContain(token);
    });

    it("does not accept an authorization failure as a reachable destination", async () => {
        const report = await inspectCandidateHostLaunchAcceptance({
            caseId: "identity-returning",
            launchUrl: launchUrl(),
            fetchImpl: vi.fn()
                .mockResolvedValueOnce(exchangeResponse({
                    location: "/candidate/dashboard",
                    requestId: requestId1,
                    cookie: sessionCookie(),
                }))
                .mockResolvedValueOnce(new Response(null, { status: 403 })),
        });

        expect(report).toMatchObject({
            passed: false,
            destination: {
                status: 403,
                reachable: false,
            },
            failures: ["destination_unreachable"],
        });
    });
});

function launchUrl() {
    return `https://staging.example.com/candidate/launch?token=${token}`;
}

function exchangeResponse({
    location,
    requestId,
    cookie,
}: {
    location: string;
    requestId: string;
    cookie?: string;
}) {
    const headers = new Headers({
        "Cache-Control": "no-store",
        Location: location,
        "Referrer-Policy": "no-referrer",
        "X-Interview-Coach-Request-Id": requestId,
    });
    if (cookie) headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 302, headers });
}

function sessionCookie({ secure = true }: { secure?: boolean } = {}) {
    return [
        `ic_candidate_launch_session=${cookieValue}`,
        "Path=/candidate",
        "HttpOnly",
        "SameSite=Lax",
        "Expires=Fri, 24 Jul 2026 12:00:00 GMT",
        secure ? "Secure" : null,
    ].filter(Boolean).join("; ");
}
