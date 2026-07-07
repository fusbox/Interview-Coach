import { describe, expect, it } from "vitest";
import {
    createCandidateSessionCompletionLinks,
    createSharedSessionContext,
    parseSessionId,
    resolveSessionCompletionTarget,
    type SessionId,
} from "./session-domain";

describe("session V2 domain contracts", () => {
    it("parses a non-empty session id", () => {
        expect(parseSessionId(" session-1 ")).toBe("session-1");
    });

    it("rejects missing session ids before route/runtime wiring", () => {
        expect(() => parseSessionId("")).toThrow("Session id is required.");
        expect(() => parseSessionId(undefined)).toThrow("Session id is required.");
    });

    it("builds candidate-owned completion links without encoding route policy into the UI shell", () => {
        const links = createCandidateSessionCompletionLinks("session 1" as SessionId);

        expect(links).toEqual({
            dashboardHref: "/candidate/dashboard",
            summaryHref: "/summary2/session%201",
        });
    });

    it("allows route adapters to override candidate completion destinations", () => {
        const links = createCandidateSessionCompletionLinks("session-1" as SessionId, {
            dashboardHref: "/candidate/home",
            summaryBaseHref: "/candidate/summary",
        });

        expect(links).toEqual({
            dashboardHref: "/candidate/home",
            summaryHref: "/candidate/summary/session-1",
        });
    });

    it("creates invited and candidate-owned shared session contexts from the same contract", () => {
        expect(
            createSharedSessionContext({
                sessionId: "invite-session",
                audience: "invited_candidate",
                candidateToken: "candidate-token",
                initialConfig: {
                    role: "QA analyst",
                    jobDescription: "Test products with care.",
                },
            }),
        ).toMatchObject({
            sessionId: "invite-session",
            audience: "invited_candidate",
            candidateToken: "candidate-token",
            initialConfig: {
                role: "QA analyst",
            },
        });

        expect(
            createSharedSessionContext({
                sessionId: "candidate-session",
                audience: "candidate_owned",
                candidateCompletionLinks: createCandidateSessionCompletionLinks("candidate-session" as SessionId),
            }),
        ).toMatchObject({
            sessionId: "candidate-session",
            audience: "candidate_owned",
            candidateCompletionLinks: {
                dashboardHref: "/candidate/dashboard",
                summaryHref: "/summary2/candidate-session",
            },
        });
    });

    it("routes candidate-owned completion back to the dashboard", () => {
        const context = createSharedSessionContext({
            sessionId: "candidate-session",
            audience: "candidate_owned",
            candidateCompletionLinks: createCandidateSessionCompletionLinks("candidate-session" as SessionId),
        });

        expect(resolveSessionCompletionTarget(context)).toEqual({
            href: "/candidate/dashboard",
            label: "Finish session",
            target: "candidate_dashboard",
        });
    });

    it("routes invited-session completion to the session summary", () => {
        const context = createSharedSessionContext({
            sessionId: "invite-session",
            audience: "invited_candidate",
            candidateCompletionLinks: createCandidateSessionCompletionLinks("invite-session" as SessionId),
        });

        expect(resolveSessionCompletionTarget(context)).toEqual({
            href: "/summary2/invite-session",
            label: "View summary",
            target: "session_summary",
        });
    });
});
