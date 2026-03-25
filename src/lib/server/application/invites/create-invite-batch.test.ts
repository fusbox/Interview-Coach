import { describe, expect, it, vi } from "vitest";
import { createInviteBatch } from "@/lib/server/application/invites/create-invite-batch";
import type { InviteRepository } from "@/lib/domain/invite";

describe("createInviteBatch", () => {
    it("returns deterministic mixed success and failure results", async () => {
        const createMock = vi
            .fn<InviteRepository["create"]>()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("database write failed"));

        const repository: InviteRepository = {
            create: createMock,
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
            succeeded: 1,
            failed: 1,
            hasFailures: true,
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
        ]);
        expect(result.failures).toEqual([
            {
                status: "failed",
                firstName: "Pat",
                lastName: "Chy",
                email: "patchy@example.com",
                code: "INVITE_CREATE_FAILED",
                message: "database write failed",
                retryable: true,
            },
        ]);
    });
});
