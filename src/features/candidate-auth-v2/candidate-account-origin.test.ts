import { describe, expect, it } from "vitest";

import { resolveCandidateAccountOrigin } from "./candidate-account-origin";

describe("candidate account origin", () => {
    it("preserves a browser-addressable LAN origin in development", () => {
        expect(resolveCandidateAccountOrigin(
            "http://192.168.1.177:3000/candidate/account/register",
            { NODE_ENV: "development" },
        )).toBe("http://192.168.1.177:3000");
    });

    it("replaces a development bind address but rejects it as configuration", () => {
        expect(resolveCandidateAccountOrigin(
            "http://0.0.0.0:3001/candidate/account/register",
            { NODE_ENV: "development" },
        )).toBe("http://localhost:3001");
        expect(() => resolveCandidateAccountOrigin(
            "http://localhost:3000",
            {
                NODE_ENV: "development",
                CANDIDATE_ACCOUNT_PUBLIC_ORIGIN: "http://0.0.0.0:3000",
            },
        )).toThrow("browser-addressable");
    });

    it("requires an explicit production origin", () => {
        expect(() => resolveCandidateAccountOrigin(
            "https://preview.example.com/candidate/account/register",
            { NODE_ENV: "production" },
        )).toThrow("CANDIDATE_ACCOUNT_PUBLIC_ORIGIN");
    });
});
