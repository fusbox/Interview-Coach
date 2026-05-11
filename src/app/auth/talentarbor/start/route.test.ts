import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";
import {
    candidateLoginNextCookieName,
    talentArborCandidateLoginUrl,
} from "@/lib/server/candidate-login-intent";

describe("GET /auth/talentarbor/start", () => {
    it("redirects to the TalentArbor candidate login and stores the selected candidate target", () => {
        const response = GET(new NextRequest("https://interviewcoach.talentarbor.com/auth/talentarbor/start?next=/practice"));

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(talentArborCandidateLoginUrl);
        expect(response.headers.get("set-cookie")).toContain(`${candidateLoginNextCookieName}=%2Fpractice`);
        expect(response.headers.get("set-cookie")).toContain("HttpOnly");
        expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
        expect(response.headers.get("set-cookie")).toContain("Secure");
    });

    it("falls back to the dashboard when next is not candidate-owned", () => {
        const response = GET(new NextRequest("https://interviewcoach.talentarbor.com/auth/talentarbor/start?next=https://evil.example"));

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(talentArborCandidateLoginUrl);
        expect(response.headers.get("set-cookie")).toContain(`${candidateLoginNextCookieName}=%2Fdashboard`);
    });
});
