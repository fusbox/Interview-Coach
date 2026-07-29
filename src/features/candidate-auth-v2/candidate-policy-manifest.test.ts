import { describe, expect, it } from "vitest";

import { getCandidatePolicyManifest } from "./candidate-policy-manifest";

describe("candidate policy manifest", () => {
    it("uses explicit immutable versions in production", () => {
        expect(getCandidatePolicyManifest({
            NODE_ENV: "production",
            CANDIDATE_TERMS_VERSION: "terms-v1",
            CANDIDATE_PRIVACY_VERSION: "privacy-v2",
            CANDIDATE_COOKIE_VERSION: "cookie-v3",
            CANDIDATE_RESPONSIBLE_AI_VERSION: "ai-v4",
            CANDIDATE_CONTACT_AUTHORIZATION_VERSION: "contact-v5",
        })).toEqual({
            termsVersion: "terms-v1",
            privacyVersion: "privacy-v2",
            cookieVersion: "cookie-v3",
            responsibleAiVersion: "ai-v4",
            contactAuthorizationVersion: "contact-v5",
        });
    });

    it("fails closed when a production policy version is missing", () => {
        expect(() => getCandidatePolicyManifest({ NODE_ENV: "production" }))
            .toThrow("CANDIDATE_TERMS_VERSION");
    });
});
