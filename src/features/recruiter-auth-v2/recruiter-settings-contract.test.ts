import { describe, expect, it } from "vitest";

import {
    normalizeRecruiterDisplayName,
    parseRecruiterSettingsUpdate,
    RecruiterSettingsValidationError,
} from "./recruiter-settings-contract";

describe("recruiter settings contract", () => {
    it("normalizes the candidate-facing name and accepts the exact update shape", () => {
        expect(parseRecruiterSettingsUpdate({
            senderDisplayName: "  Dev   Recruiter  ",
            revision: "2026-07-20T12:00:00.000000Z",
        })).toEqual({
            senderDisplayName: "Dev Recruiter",
            revision: "2026-07-20T12:00:00.000000Z",
        });
        expect(normalizeRecruiterDisplayName("Ｆｕ Chen")).toBe("Fu Chen");
    });

    it.each([
        null,
        {},
        { senderDisplayName: "Dev Recruiter" },
        { senderDisplayName: "Dev Recruiter", revision: "not-a-revision" },
        { senderDisplayName: "Dev Recruiter", revision: "2026-07-20T12:00:00Z", userId: "foreign" },
        { senderDisplayName: "\u0000Dev Recruiter", revision: "2026-07-20T12:00:00Z" },
        { senderDisplayName: "x".repeat(81), revision: "2026-07-20T12:00:00Z" },
    ])("rejects invalid or expanded update input", (input) => {
        expect(() => parseRecruiterSettingsUpdate(input)).toThrow(RecruiterSettingsValidationError);
    });

    it("counts Unicode code points rather than UTF-16 code units", () => {
        const name = "A".repeat(79) + "𐐷";
        expect(Array.from(name)).toHaveLength(80);
        expect(normalizeRecruiterDisplayName(name)).toBe(name);
    });
});
