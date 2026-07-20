import { describe, expect, it, vi } from "vitest";

import {
    confirmInvitedPracticeInitials,
    exchangeInvitedPracticeLink,
    InvalidInvitedPracticeInitialsError,
    normalizeInvitedPracticeInitials,
    resolveInvitedPracticeEntry,
} from "./invited-practice-entry-service";

describe("invited practice entry service", () => {
    it("rejects malformed invitation tokens before repository access", async () => {
        const repository = repositoryMock();
        await expect(exchangeInvitedPracticeLink({
            rawInvitationToken: "short",
            now: new Date("2026-07-20T00:00:00.000Z"),
            accessTtlSeconds: 604_800,
        }, { repository })).resolves.toBeNull();
        expect(repository.exchangeInvitationToken).not.toHaveBeenCalled();
    });

    it("mints a separate browser bearer and requests a bounded exchange", async () => {
        const repository = repositoryMock();
        repository.exchangeInvitationToken.mockResolvedValue(context());
        const result = await exchangeInvitedPracticeLink({
            rawInvitationToken: "i".repeat(43),
            now: new Date("2026-07-20T00:00:00.000Z"),
            accessTtlSeconds: 604_800,
        }, {
            repository,
            createBrowserSessionMaterial: () => ({
                browserSessionId: "10000000-0000-4000-8000-000000000001",
                rawSessionToken: "s".repeat(43),
                sessionTokenHash: "b".repeat(64),
            }),
        });

        expect(result).toMatchObject({
            rawBrowserSessionToken: "s".repeat(43),
            expiresAt: "2026-07-27T00:00:00.000Z",
            entry: { targetRole: "Quality Inspector", initialsConfirmed: false },
        });
        expect(repository.exchangeInvitationToken).toHaveBeenCalledWith(expect.objectContaining({
            invitationTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
            browserSessionTokenHash: "b".repeat(64),
            requestedExpiresAt: "2026-07-27T00:00:00.000Z",
        }));
    });

    it("does not expose the intended first name before a durable initials match", async () => {
        const repository = repositoryMock();
        repository.resolveBrowserSession.mockResolvedValue(context());
        await expect(resolveInvitedPracticeEntry("s".repeat(43), repository)).resolves.toEqual({
            targetRole: "Quality Inspector",
            interviewStage: "screening",
            questionCount: 1,
            sessionStatus: "planned",
            initialsConfirmed: false,
        });
    });

    it("continues on mismatch and reveals the first name only on match", async () => {
        const repository = repositoryMock();
        repository.confirmInitials
            .mockResolvedValueOnce({
                firstName: "Irma",
                signal: { enteredInitials: "XX", expectedInitials: "IC", matchState: "mismatch", createdAt: "now" },
            })
            .mockResolvedValueOnce({
                firstName: "Irma",
                signal: { enteredInitials: "IC", expectedInitials: "IC", matchState: "match", createdAt: "now" },
            });

        await expect(confirmInvitedPracticeInitials({
            rawBrowserSessionToken: "s".repeat(43),
            initials: "xx",
        }, repository)).resolves.toEqual({ initialsConfirmed: true, matchState: "mismatch" });
        await expect(confirmInvitedPracticeInitials({
            rawBrowserSessionToken: "s".repeat(43),
            initials: "ic",
        }, repository)).resolves.toEqual({
            initialsConfirmed: true,
            matchState: "match",
            candidateFirstName: "Irma",
        });
    });

    it("normalizes one or two Unicode letters and rejects empty input", async () => {
        expect(normalizeInvitedPracticeInitials(" é-ß3 ")).toBe("ÉS");
        expect(normalizeInvitedPracticeInitials("李 小")).toBe("李小");
        const repository = repositoryMock();
        await expect(confirmInvitedPracticeInitials({
            rawBrowserSessionToken: "s".repeat(43),
            initials: "123",
        }, repository)).rejects.toBeInstanceOf(InvalidInvitedPracticeInitialsError);
    });
});

function repositoryMock() {
    return {
        exchangeInvitationToken: vi.fn(),
        resolveBrowserSession: vi.fn(),
        confirmInitials: vi.fn(),
    };
}

function context() {
    return {
        browserSessionId: "10000000-0000-4000-8000-000000000001",
        browserSessionExpiresAt: "2026-07-27T00:00:00.000Z",
        sourceTokenExpiresAt: "2026-08-03T00:00:00.000Z",
        sessionId: "30000000-0000-4000-8000-000000000001",
        recipientId: "40000000-0000-4000-8000-000000000001",
        recruiterId: "20000000-0000-4000-8000-000000000001",
        firstName: "Irma",
        lastName: "Castillo",
        status: "planned" as const,
        targetRole: "Quality Inspector",
        interviewStage: "screening" as const,
        questionPlanSnapshot: { questionCount: 1 },
        questionWordingSnapshot: { status: "questions_worded", questions: [] },
        progress: { status: "planned", currentQuestionIndex: 0 },
        entrySignal: null,
    };
}
