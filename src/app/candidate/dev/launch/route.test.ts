import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("/candidate/dev/launch route", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("is unavailable until dev host launch mode is explicitly enabled", async () => {
        const response = await GET(new Request("http://localhost:3000/candidate/dev/launch"));

        expect(response.status).toBe(404);
    });

    it("mints a local host-shaped token and redirects through the real launch route", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        const response = await GET(new Request("http://localhost:3000/candidate/dev/launch?candidate=alternate&next=/candidate/setup"));
        const location = response.headers.get("Location");

        expect(response.status).toBe(302);
        expect(location).toMatch(/^\/candidate\/launch\?token=/);
        expect(location).toContain("next=%2Fcandidate%2Fsetup");
        expect(location).not.toContain("candidate-dev-alt@talentarbor.local");
    });

    it("uses a relative redirect so LAN browsers keep their current host", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        const response = await GET(new Request("http://0.0.0.0:3000/candidate/dev/launch?next=/candidate/setup"));

        expect(response.headers.get("Location")).toMatch(/^\/candidate\/launch\?token=/);
        expect(response.headers.get("Location")).not.toContain("0.0.0.0");
    });
});
