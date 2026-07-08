import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("/candidate/launch route", () => {
    it("fails closed and redirects to the candidate dashboard when the verifier is not configured", async () => {
        const response = await GET(new Request("https://interviewcoach.talentarbor.com/candidate/launch?token=signed.jwt"));

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("https://interviewcoach.talentarbor.com/candidate/dashboard");
        expect(response.headers.get("Set-Cookie")).toBeNull();
    });
});
