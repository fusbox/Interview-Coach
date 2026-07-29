import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createCandidateLoginRouteHandler } from "./login/route-implementation";
import { createCandidateLogoutRouteHandler } from "./logout/route-implementation";
import { createCandidateRegisterRouteHandler } from "./register/route-implementation";
import { createCandidateVerificationConsumeRouteHandler } from "./verification/consume/route-implementation";
import { createCandidateVerificationResendRouteHandler } from "./verification/resend/route-implementation";
import { createCandidatePasswordResetRequestRouteHandler } from "./password-reset/request/route-implementation";
import { createCandidatePasswordResetConsumeRouteHandler } from "./password-reset/consume/route-implementation";

const origin = "http://localhost:3000";
const trustedHeaders = {
    origin,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
};
const allowRateLimit = vi.fn().mockResolvedValue({ allowed: true as const });

const validRegistration = {
    firstName: "Dev",
    lastName: "Candidate",
    email: "candidate@example.com",
    password: "long-candidate-password",
    phone: "3125550199",
    postalCode: "60601",
    contactPreferences: {
        email: true,
        sms: false,
        phone: false,
    },
    contactAuthorization: true,
    platformPolicyAccepted: true,
    responsibleAiAcknowledged: true,
};

describe("candidate account routes", () => {
    it("rejects cross-origin candidate account mutations", async () => {
        const register = vi.fn();
        const response = await createCandidateRegisterRouteHandler({ register, rateLimit: allowRateLimit })(new NextRequest(
            `${origin}/candidate/account/register`,
            {
                method: "POST",
                headers: {
                    ...trustedHeaders,
                    origin: "https://attacker.example",
                },
                body: JSON.stringify(validRegistration),
            },
        ));

        expect(response.status).toBe(403);
        expect(register).not.toHaveBeenCalled();
    });

    it("accepts valid registration without exposing delivery or duplicate outcomes", async () => {
        for (const outcome of ["accepted", "delivery_failed"] as const) {
            const register = vi.fn().mockResolvedValue({ outcome });
            const response = await createCandidateRegisterRouteHandler({
                register,
                resolveOrigin: () => origin,
                rateLimit: allowRateLimit,
            })(new NextRequest(`${origin}/candidate/account/register`, {
                method: "POST",
                headers: trustedHeaders,
                body: JSON.stringify(validRegistration),
            }));

            expect(response.status).toBe(202);
            await expect(response.json()).resolves.toEqual({
                status: "verification_pending",
                message: "If this address can be registered, a verification email is on its way.",
            });
        }
    });

    it("returns a development verification URL only when supplied by the service", async () => {
        const response = await createCandidateRegisterRouteHandler({
            register: vi.fn().mockResolvedValue({
                outcome: "accepted",
                developmentVerificationUrl: `${origin}/candidate/verify-email?token=fixture`,
            }),
            resolveOrigin: () => origin,
            rateLimit: allowRateLimit,
        })(new NextRequest(`${origin}/candidate/account/register`, {
            method: "POST",
            headers: trustedHeaders,
            body: JSON.stringify(validRegistration),
        }));

        await expect(response.json()).resolves.toEqual(expect.objectContaining({
            developmentVerificationUrl: `${origin}/candidate/verify-email?token=fixture`,
        }));
    });

    it("keeps resend outcomes enumeration-safe", async () => {
        for (const outcome of ["accepted", "delivery_failed"] as const) {
            const response = await createCandidateVerificationResendRouteHandler({
                resend: vi.fn().mockResolvedValue({ outcome }),
                resolveOrigin: () => origin,
                rateLimit: allowRateLimit,
            })(new NextRequest(`${origin}/candidate/account/verification/resend`, {
                method: "POST",
                headers: trustedHeaders,
                body: JSON.stringify({ email: "candidate@example.com" }),
            }));

            expect(response.status).toBe(202);
            await expect(response.json()).resolves.toEqual({
                status: "verification_pending",
                message: "If that account needs verification, a new email is on its way.",
            });
        }
    });

    it("consumes verification tokens only through an explicit same-origin POST", async () => {
        const consume = vi.fn().mockResolvedValue({
            outcome: "verified",
            userId: "candidate-user-1",
        });
        const response = await createCandidateVerificationConsumeRouteHandler({
            consume,
            rateLimit: allowRateLimit,
        })(
            new NextRequest(`${origin}/candidate/account/verification/consume`, {
                method: "POST",
                headers: trustedHeaders,
                body: JSON.stringify({ token: "a".repeat(64) }),
            }),
        );

        expect(response.status).toBe(200);
        expect(consume).toHaveBeenCalledWith("a".repeat(64));
        await expect(response.json()).resolves.toEqual(expect.objectContaining({
            outcome: "verified",
        }));
    });

    it("issues the candidate-only cookie after verified candidate authentication", async () => {
        const authenticate = vi.fn().mockResolvedValue({
            ok: true,
            user: {
                id: "candidate-user-1",
                email: "candidate@example.com",
                emailVerifiedAt: "2026-07-27T12:00:00.000Z",
                status: "active",
                roles: ["candidate"],
            },
            sessionToken: "candidate-secret",
            expiresAt: "2026-08-03T12:00:00.000Z",
        });
        const response = await createCandidateLoginRouteHandler({
            authenticate,
            rateLimit: allowRateLimit,
        })(new NextRequest(
            `${origin}/candidate/account/login`,
            {
                method: "POST",
                headers: trustedHeaders,
                body: JSON.stringify({
                    email: "candidate@example.com",
                    password: "candidate-password",
                }),
            },
        ));

        expect(response.status).toBe(200);
        expect(response.headers.get("set-cookie")).toContain("ic_candidate_app_session=candidate-secret");
        expect(response.headers.get("set-cookie")).toContain("HttpOnly");
        expect(authenticate).toHaveBeenCalledWith(
            "candidate@example.com",
            "candidate-password",
            { userAgent: null, ipAddress: null },
            {},
            {
                requiredRole: "candidate",
                requireVerifiedEmail: true,
                requireCandidateProfile: true,
            },
        );
    });

    it("uses one generic login rejection for every candidate policy failure", async () => {
        const response = await createCandidateLoginRouteHandler({
            authenticate: vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                error: "Invalid email or password.",
            }),
            rateLimit: allowRateLimit,
        })(new NextRequest(`${origin}/candidate/account/login`, {
            method: "POST",
            headers: trustedHeaders,
            body: JSON.stringify({
                email: "candidate@example.com",
                password: "candidate-password",
            }),
        }));

        expect(response.status).toBe(401);
        expect(response.headers.get("set-cookie")).toBeNull();
        await expect(response.json()).resolves.toEqual({
            code: "AUTHENTICATION_FAILED",
            message: "Invalid email or password.",
        });
    });

    it("revokes and clears only the candidate app session", async () => {
        const revoke = vi.fn().mockResolvedValue(undefined);
        const response = await createCandidateLogoutRouteHandler({ revoke })(new NextRequest(
            `${origin}/candidate/account/logout`,
            {
                method: "POST",
                headers: {
                    ...trustedHeaders,
                    cookie: "ic_candidate_app_session=candidate-secret; ic_app_session=recruiter-secret",
                },
            },
        ));

        expect(response.status).toBe(200);
        expect(revoke).toHaveBeenCalledWith(
            "candidate-secret",
            { userAgent: null, ipAddress: null },
        );
        const cookie = response.headers.get("set-cookie") ?? "";
        expect(cookie).toContain("ic_candidate_app_session=");
        expect(cookie).toContain("Max-Age=0");
        expect(cookie).not.toContain("ic_app_session=");
    });

    it("keeps password-reset requests enumeration-safe", async () => {
        for (const outcome of ["accepted", "delivery_failed"] as const) {
            const response = await createCandidatePasswordResetRequestRouteHandler({
                requestReset: vi.fn().mockResolvedValue({ outcome }),
                resolveOrigin: () => origin,
                rateLimit: allowRateLimit,
            })(new NextRequest(`${origin}/candidate/account/password-reset/request`, {
                method: "POST",
                headers: trustedHeaders,
                body: JSON.stringify({ email: "candidate@example.com" }),
            }));

            expect(response.status).toBe(202);
            await expect(response.json()).resolves.toEqual({
                status: "reset_pending",
                message: "If that candidate account exists, a password reset email is on its way.",
            });
        }
    });

    it("resets the password without creating a replacement session", async () => {
        const consumeReset = vi.fn().mockResolvedValue({
            outcome: "reset",
            userId: "candidate-user-1",
            revokedSessionCount: 3,
        });
        const response = await createCandidatePasswordResetConsumeRouteHandler({
            consumeReset,
            rateLimit: allowRateLimit,
        })(new NextRequest(`${origin}/candidate/account/password-reset/consume`, {
            method: "POST",
            headers: trustedHeaders,
            body: JSON.stringify({
                token: "r".repeat(64),
                password: "new-candidate-password",
            }),
        }));

        expect(response.status).toBe(200);
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(consumeReset).toHaveBeenCalledWith(
            {
                token: "r".repeat(64),
                password: "new-candidate-password",
            },
            { userAgent: null, ipAddress: null },
        );
        await expect(response.json()).resolves.toEqual(expect.objectContaining({
            revokedSessionCount: 3,
        }));
    });

    it("distinguishes an expired reset link from an invalid or consumed one", async () => {
        const response = await createCandidatePasswordResetConsumeRouteHandler({
            consumeReset: vi.fn().mockResolvedValue({ outcome: "expired" }),
            rateLimit: allowRateLimit,
        })(new NextRequest(`${origin}/candidate/account/password-reset/consume`, {
            method: "POST",
            headers: trustedHeaders,
            body: JSON.stringify({
                token: "r".repeat(64),
                password: "new-candidate-password",
            }),
        }));

        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toEqual({
            code: "PASSWORD_RESET_EXPIRED",
            message: "This password reset link has expired. Request a new one.",
        });
    });

    it("returns a bounded 429 before invoking an account mutation", async () => {
        const authenticate = vi.fn();
        const response = await createCandidateLoginRouteHandler({
            authenticate,
            rateLimit: vi.fn().mockResolvedValue({
                allowed: false,
                retryAfterSeconds: 45,
            }),
        })(new NextRequest(`${origin}/candidate/account/login`, {
            method: "POST",
            headers: trustedHeaders,
            body: JSON.stringify({
                email: "candidate@example.com",
                password: "candidate-password",
            }),
        }));

        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("45");
        expect(authenticate).not.toHaveBeenCalled();
    });
});
