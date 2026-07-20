import { describe, expect, it } from "vitest";

import { resolveRecruiterInvitationAppOrigin } from "./recruiter-invitation-app-origin";

describe("recruiter invitation app origin", () => {
    it("uses the configured production HTTPS origin without carrying a path", () => {
        expect(resolveRecruiterInvitationAppOrigin(
            "http://localhost:3000/api/recruiter/invitations",
            { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://coach.example/app?source=test" },
        )).toBe("https://coach.example");
    });

    it("derives an HTTP request origin outside production even when a default URL is configured", () => {
        expect(resolveRecruiterInvitationAppOrigin(
            "http://192.168.1.177:3001/api/recruiter/invitations",
            { NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
        )).toBe("http://192.168.1.177:3001");
    });

    it("requires an explicit HTTPS origin in production", () => {
        expect(() => resolveRecruiterInvitationAppOrigin(
            "https://coach.example/api/recruiter/invitations",
            { NODE_ENV: "production" },
        )).toThrow("NEXT_PUBLIC_APP_URL");
        expect(() => resolveRecruiterInvitationAppOrigin(
            "https://coach.example/api/recruiter/invitations",
            { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://coach.example" },
        )).toThrow("HTTPS in production");
        expect(resolveRecruiterInvitationAppOrigin(
            "http://internal.invalid/api/recruiter/invitations",
            { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://coach.example" },
        )).toBe("https://coach.example");
    });

    it("rejects unsupported protocols", () => {
        expect(() => resolveRecruiterInvitationAppOrigin(
            "http://localhost:3000/api/recruiter/invitations",
            { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "ftp://coach.example" },
        )).toThrow("HTTP or HTTPS");
    });
});
