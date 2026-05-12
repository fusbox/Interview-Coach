import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /auth/callback", () => {
    it("redirects only to a safe internal callback target", async () => {
        const response = await GET(new NextRequest("https://interviewcoach.talentarbor.com/auth/callback?next=/practice"));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("https://interviewcoach.talentarbor.com/practice");
    });

    it.each([
        "https://evil.example/practice",
        "//evil.example/practice",
        "/practice?return=https://evil.example",
        "/dashboard#token",
        "/api/auth/logout",
    ])("falls back instead of redirecting to unsafe callback target %s", async (next) => {
        const response = await GET(new NextRequest(`https://interviewcoach.talentarbor.com/auth/callback?next=${encodeURIComponent(next)}`));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("https://interviewcoach.talentarbor.com/dashboard");
    });
});
