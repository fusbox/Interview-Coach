import { describe, expect, it, vi } from "vitest";
import { createInviteBatch } from "@/lib/server/application/invites/create-invite-batch";
import type { InviteRepository } from "@/lib/domain/invite";

describe("createInviteBatch", () => {
    it("returns created results when the batch write succeeds", async () => {
        const createBatchMock = vi.fn<InviteRepository["createBatch"]>().mockResolvedValue(undefined);

        const repository: InviteRepository = {
            create: vi.fn(),
            createBatch: createBatchMock,
            getByToken: vi.fn(),
        };

        const result = await createInviteBatch(
            {
                role: "QA Engineer",
                jobDescription: "Own API quality",
                createdBy: "user-1",
                appBaseUrl: "https://app.example.com",
                candidates: [
                    {
                        firstName: "Cand",
                        lastName: "Date",
                        email: "candidate@example.com",
                        reqId: "REQ-1",
                    },
                    {
                        firstName: "Pat",
                        lastName: "Chy",
                        email: "patchy@example.com",
                        reqId: "REQ-1",
                    },
                ],
                questions: [
                    {
                        text: "Tell me about a bug you found.",
                        category: "STAR",
                        index: 0,
                    },
                ],
            },
            {
                repository,
                createSessionId: vi
                    .fn()
                    .mockReturnValueOnce("session-1")
                    .mockReturnValueOnce("session-2"),
                createToken: vi
                    .fn()
                    .mockReturnValueOnce("token-1")
                    .mockReturnValueOnce("token-2"),
            }
        );

        expect(result.summary).toEqual({
            requested: 2,
            succeeded: 2,
            failed: 0,
            hasFailures: false,
        });
        expect(result.results).toEqual([
            {
                status: "created",
                id: "session-1",
                firstName: "Cand",
                lastName: "Date",
                email: "candidate@example.com",
                link: "https://app.example.com/s/token-1",
            },
            {
                status: "created",
                id: "session-2",
                firstName: "Pat",
                lastName: "Chy",
                email: "patchy@example.com",
                link: "https://app.example.com/s/token-2",
            },
        ]);
        expect(result.failures).toEqual([]);
        expect(createBatchMock).toHaveBeenCalledTimes(1);
    });

    it("returns deterministic all-failure results when the atomic batch write fails", async () => {
        const createBatchMock = vi.fn<InviteRepository["createBatch"]>().mockRejectedValue(new Error("database write failed"));

        const repository: InviteRepository = {
            create: vi.fn(),
            createBatch: createBatchMock,
            getByToken: vi.fn(),
        };

        const result = await createInviteBatch(
            {
                role: "QA Engineer",
                jobDescription: "Own API quality",
                createdBy: "user-1",
                appBaseUrl: "https://app.example.com",
                candidates: [
                    {
                        firstName: "Cand",
                        lastName: "Date",
                        email: "candidate@example.com",
                        reqId: "REQ-1",
                    },
                    {
                        firstName: "Pat",
                        lastName: "Chy",
                        email: "patchy@example.com",
                        reqId: "REQ-2",
                    },
                ],
                questions: [
                    {
                        text: "Tell me about a bug you found.",
                        category: "STAR",
                        index: 0,
                    },
                ],
            },
            {
                repository,
                createSessionId: vi.fn().mockReturnValueOnce("session-1").mockReturnValueOnce("session-2"),
                createToken: vi.fn().mockReturnValueOnce("token-1").mockReturnValueOnce("token-2"),
            }
        );

        expect(result.summary).toEqual({
            requested: 2,
            succeeded: 0,
            failed: 2,
            hasFailures: true,
        });
        expect(result.results).toEqual([]);
        expect(result.failures).toEqual([
            expect.objectContaining({
                status: "failed",
                email: "candidate@example.com",
                code: "INVITE_CREATE_FAILED",
                message: "database write failed",
                retryable: true,
            }),
            expect.objectContaining({
                status: "failed",
                email: "patchy@example.com",
                code: "INVITE_CREATE_FAILED",
                message: "database write failed",
                retryable: true,
            }),
        ]);
        expect(createBatchMock).toHaveBeenCalledTimes(1);
    });
});
