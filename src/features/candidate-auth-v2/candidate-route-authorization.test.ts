import { describe, expect, it, vi } from "vitest";

import {
    createCandidateLoginHref,
    createCandidateReturnPath,
    resolveCandidateEntryDestination,
    resolveCandidateOwnedCookieIdentity,
    resolveCandidateOwnedRequestIdentity,
} from "./candidate-route-authorization";
import { CANDIDATE_APP_SESSION_COOKIE } from "./candidate-route-access";

describe("candidate route authorization", () => {
    it("projects app-account access into the shared candidate-owned identity", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                user_id: "11111111-1111-4111-8111-111111111111",
                candidate_profile_id: "22222222-2222-4222-8222-222222222222",
            }],
        });

        await expect(resolveCandidateOwnedRequestIdentity(
            new Request("https://example.test/candidate/dashboard", {
                headers: { cookie: `${CANDIDATE_APP_SESSION_COOKIE}=candidate-session` },
            }),
            { query },
        )).resolves.toEqual({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            accessSource: "app_account",
        });
    });

    it("does not let a stale app cookie fall through to host access", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });

        await expect(resolveCandidateOwnedCookieIdentity(
            `${CANDIDATE_APP_SESSION_COOKIE}=stale; ic_candidate_launch_session=valid-host`,
            { query },
        )).resolves.toBeNull();
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).not.toContain("candidate_launch_sessions");
    });

    it("does not treat recruiter or invited access cookies as candidate-owned access", async () => {
        const query = vi.fn();

        await expect(resolveCandidateOwnedCookieIdentity(
            "ic_app_session=recruiter-session; ic_invited_access=invited-session",
            { query },
        )).resolves.toBeNull();
        expect(query).not.toHaveBeenCalled();
    });

    it("preserves bounded candidate query state in login return paths", () => {
        expect(createCandidateReturnPath("/candidate/dashboard", {
            prep: "prep-1",
            filter: ["active", "recent"],
            ignored: undefined,
        })).toBe("/candidate/dashboard?prep=prep-1&filter=active&filter=recent");
    });

    it.each([
        ["/candidate/setup", "/candidate/login?next=%2Fcandidate%2Fsetup"],
        ["/candidate/session/session-1?entry=1", "/candidate/login?next=%2Fcandidate%2Fsession%2Fsession-1%3Fentry%3D1"],
        ["https://evil.example/candidate/session/1", "/candidate/login?next=%2Fcandidate"],
    ])("creates a bounded login target for %s", (target, expected) => {
        expect(createCandidateLoginHref(target)).toBe(expected);
    });

    it("routes a candidate without a prep context to setup", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        await expect(resolveCandidateEntryDestination({
            candidateProfileId: "candidate-1",
            accessSource: "app_account",
        }, { query })).resolves.toBe("/candidate/setup");
        expect(query.mock.calls[0][0]).toContain("status <> 'archived'");
        expect(query.mock.calls[0][1]).toEqual(["candidate-1"]);
    });

    it("routes a candidate with an owned prep context to the dashboard", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{ role_profile_id: "prep-1" }] });
        await expect(resolveCandidateEntryDestination({
            candidateProfileId: "candidate-1",
            accessSource: "host_launch",
        }, { query })).resolves.toBe("/candidate/dashboard");
    });
});
