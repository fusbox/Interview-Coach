import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
    RecruiterInvitationHandoffFact,
    RecruiterInvitationHandoffReadModel,
} from "@/features/recruiter-invites-v2/recruiter-invitation-handoff-read-model";
import { renderRecruiterInvitationHandoffRoute } from "./RecruiterInvitationHandoffRoute";

const { notFoundMock, redirectMock } = vi.hoisted(() => ({
    notFoundMock: vi.fn(() => { throw new Error("not-found"); }),
    redirectMock: vi.fn((target: string) => { throw new Error(`redirect:${target}`); }),
}));

vi.mock("next/navigation", () => ({
    notFound: notFoundMock,
    redirect: redirectMock,
    useRouter: () => ({ refresh: vi.fn() }),
}));

describe("recruiter invitation handoff page", () => {
    it("loads one batch only through the authenticated recruiter owner", async () => {
        const loadHandoffFact = vi.fn().mockResolvedValue(fact());
        render(await renderRecruiterInvitationHandoffRoute({
            params: Promise.resolve({ batchId: "batch-1" }),
            resolveAccess: authorizedAccess,
            loadHandoffFact,
            buildReadModel: async () => model(),
        }));

        expect(loadHandoffFact).toHaveBeenCalledWith("recruiter-1", "batch-1");
        expect(screen.getByRole("heading", { name: "Quality Inspector" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Send pending invitations" })).toBeInTheDocument();
    });

    it("uses one not-found boundary for unknown and foreign-owned batches", async () => {
        await expect(renderRecruiterInvitationHandoffRoute({
            params: { batchId: "foreign-batch" },
            resolveAccess: authorizedAccess,
            loadHandoffFact: async () => null,
            buildReadModel: async () => model(),
        })).rejects.toThrow("not-found");
        expect(notFoundMock).toHaveBeenCalledTimes(1);
    });

    it("does not query batch data for missing or forbidden recruiter access", async () => {
        const loadHandoffFact = vi.fn();
        await expect(renderRecruiterInvitationHandoffRoute({
            params: { batchId: "batch-1" },
            resolveAccess: async () => ({ kind: "missing" }),
            loadHandoffFact,
        })).rejects.toThrow("redirect:/login?next=%2Frecruiter%2Finvitations%2Fbatch-1");
        expect(loadHandoffFact).not.toHaveBeenCalled();

        render(await renderRecruiterInvitationHandoffRoute({
            params: { batchId: "batch-1" },
            resolveAccess: async () => ({ kind: "forbidden", user: { ...recruiterUser(), roles: ["qa"] } }),
            loadHandoffFact,
        }));
        expect(screen.getByRole("heading", { name: "This account does not have recruiter access." })).toBeInTheDocument();
        expect(loadHandoffFact).not.toHaveBeenCalled();
    });
});

async function authorizedAccess() {
    return { kind: "authorized" as const, user: recruiterUser() };
}

function recruiterUser() {
    return {
        id: "recruiter-1",
        email: "recruiter@example.invalid",
        displayName: "Dev Recruiter",
        status: "active" as const,
        roles: ["recruiter" as const],
    };
}

function fact(): RecruiterInvitationHandoffFact {
    return {
        batchId: "batch-1",
        batchLifecycleState: "ready",
        targetRole: "Quality Inspector",
        interviewStage: "screening",
        recipientCount: 1,
        batchCreatedAt: "2026-07-20T10:00:00.000Z",
        batchUpdatedAt: "2026-07-20T10:00:00.000Z",
        recipients: [],
    };
}

function model(): RecruiterInvitationHandoffReadModel {
    return {
        batchId: "batch-1",
        targetRole: "Quality Inspector",
        interviewStageLabel: "Screening call",
        createdAt: "2026-07-20T10:00:00.000Z",
        recipientCount: 1,
        lifecycleState: "ready",
        revision: "2026-07-20T10:00:00.000Z",
        sendEligibleCount: 1,
        retryEligibleCount: 0,
        recipients: [],
    };
}
