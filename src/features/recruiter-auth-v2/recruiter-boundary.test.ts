import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getCurrentRecruiterAccess } from "./current-recruiter-access";
import {
    protectRecruiterRoute,
    RECRUITER_RETURN_TARGET_HEADER,
} from "./recruiter-auth-middleware";
import { resolveRecruiterReturnTarget } from "./recruiter-return-target";

const baseUser = {
    id: "user-1",
    email: "user@example.com",
    status: "active" as const,
    roles: ["recruiter" as const],
};

describe("recruiter route boundary", () => {
    it.each([
        ["/recruiter", "/recruiter"],
        ["/recruiter/dashboard?tab=active", "/recruiter/dashboard?tab=active"],
        ["/candidate/dashboard", "/recruiter"],
        ["https://evil.example/recruiter", "/recruiter"],
        ["//evil.example/recruiter", "/recruiter"],
        ["javascript:alert(1)", "/recruiter"],
        [undefined, "/recruiter"],
    ])("resolves return target %s", (input, expected) => {
        expect(resolveRecruiterReturnTarget(input)).toBe(expected);
    });

    it("redirects an anonymous request with its exact safe recruiter return target", () => {
        const response = protectRecruiterRoute(new NextRequest(
            "http://localhost:3000/recruiter/dashboard?tab=active",
        ));
        const location = response.headers.get("location");
        expect(response.status).toBe(307);
        expect(location).toContain("/login?");
        expect(new URL(location!).searchParams.get("next")).toBe("/recruiter/dashboard?tab=active");
    });

    it("does not treat the candidate launch cookie as recruiter authentication", () => {
        const request = new NextRequest("http://localhost:3000/recruiter", {
            headers: { cookie: "ic_candidate_launch_session=candidate-session" },
        });
        expect(protectRecruiterRoute(request).status).toBe(307);
    });

    it("passes an exact safe return target to the server layout for stale-cookie recovery", () => {
        const request = new NextRequest("http://localhost:3000/recruiter/sessions/session-1?view=answers", {
            headers: {
                cookie: "ic_app_session=unverified-bearer",
                [RECRUITER_RETURN_TARGET_HEADER]: "https://evil.example/recruiter",
            },
        });
        const response = protectRecruiterRoute(request);
        expect(response.headers.get("x-middleware-next")).toBe("1");
        expect(response.headers.get(`x-middleware-request-${RECRUITER_RETURN_TARGET_HEADER}`))
            .toBe("/recruiter/sessions/session-1?view=answers");
    });

    it.each([
        [["recruiter"], "authorized"],
        [["admin"], "authorized"],
        [["qa"], "forbidden"],
        [[], "forbidden"],
    ] as const)("resolves role set %s as %s", async (roles, kind) => {
        const access = await getCurrentRecruiterAccess({
            cookieStore: { get: () => ({ value: "app-session" }) },
            resolveUser: vi.fn().mockResolvedValue({ ...baseUser, roles: [...roles] }),
        });
        expect(access.kind).toBe(kind);
    });

    it("fails closed when no valid app session resolves", async () => {
        const access = await getCurrentRecruiterAccess({
            cookieStore: { get: () => undefined },
            resolveUser: vi.fn().mockResolvedValue(null),
        });
        expect(access).toEqual({ kind: "missing" });
    });
});
