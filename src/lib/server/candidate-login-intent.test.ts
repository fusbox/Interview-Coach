import { describe, expect, it } from "vitest";

import {
    defaultCandidateLoginNext,
    resolveCandidateLoginNext,
} from "@/lib/server/candidate-login-intent";

describe("candidate login intent", () => {
    it.each([
        ["/practice"],
        ["/dashboard"],
        ["/session/session_123"],
        ["/summary"],
        ["/summary/session-123"],
    ])("allows candidate-owned return path %s", (next) => {
        expect(resolveCandidateLoginNext(next)).toBe(next);
    });

    it.each([
        [null],
        [undefined],
        [""],
        ["https://evil.example/practice"],
        ["//evil.example/practice"],
        ["/recruiter"],
        ["/recruiter/dashboard"],
        ["/admin/feedback"],
        ["/qa/ai-quality"],
        ["/practice?return=https://evil.example"],
        ["/dashboard#token"],
        ["%2F%2Fevil.example%2Fpractice"],
    ])("falls back safely for invalid next value %s", (next) => {
        expect(resolveCandidateLoginNext(next)).toBe(defaultCandidateLoginNext);
    });
});
