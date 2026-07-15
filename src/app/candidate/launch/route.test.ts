import { createHmac } from "crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import {
    CANDIDATE_DEV_HOST_LAUNCH_FIXTURES,
    mintCandidateDevHostLaunchToken,
} from "@/features/candidate-auth-v2/dev-host-launch";

describe("/candidate/launch route", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.useRealTimers();
    });

    it("fails closed and redirects to the candidate dashboard when the verifier is not configured", async () => {
        const response = await GET(new Request("https://interviewcoach.talentarbor.com/candidate/launch?token=signed.jwt"));

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/dashboard");
        expect(response.headers.get("Set-Cookie")).toBeNull();
    });

    it("accepts a local dev host-launch token only when explicit dev mode is enabled", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"));
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");
        const token = await mintCandidateDevHostLaunchToken({
            fixture: CANDIDATE_DEV_HOST_LAUNCH_FIXTURES.primary,
            secret: "local-dev-shared-secret",
            now: new Date("2026-07-08T12:00:00.000Z"),
        });

        const response = await GET(new Request(`https://interviewcoach.talentarbor.com/candidate/launch?token=${token}&next=/candidate/setup`));

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/setup");
        expect(response.headers.get("Set-Cookie")).toContain("ic_candidate_launch_session=dev-host-launch-100001");
    });

    it("assembles production launch dependencies but fails closed until TA/RW context lookup is implemented", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_SECRET", "production-launch-secret");
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres");
        const token = signJwt({
            candidate_id: "12345",
            product: "interview-coach",
            email: "candidate@example.com",
            exp: "1783530000",
            job_collection_id: "555",
            source_surface: "TA_JOB_SEARCH",
            host_domain: "talentarbor.com",
        }, "production-launch-secret");

        const response = await GET(new Request(`https://interviewcoach.talentarbor.com/candidate/launch?token=${token}&next=/candidate/setup`));

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/dashboard");
        expect(response.headers.get("Set-Cookie")).toBeNull();
    });
});

function signJwt(claims: Record<string, unknown>, secret: string) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signingInput = `${header}.${payload}`;
    const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

    return `${signingInput}.${signature}`;
}
