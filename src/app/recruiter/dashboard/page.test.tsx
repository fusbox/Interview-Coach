import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RecruiterDashboardRecipientFact } from "@/features/recruiter-invites-v2/recruiter-dashboard-read-model";
import { renderRecruiterDashboardRoute } from "./RecruiterDashboardRoute";

const { redirectMock } = vi.hoisted(() => ({
    redirectMock: vi.fn((target: string) => {
        throw new Error(`redirect:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({
    redirect: redirectMock,
    useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("recruiter dashboard page", () => {
    it("loads an authorized recruiter's owned invitation activity", async () => {
        const loadRecipientFacts = vi.fn().mockResolvedValue([fact()]);
        render(await renderRecruiterDashboardRoute({
            resolveAccess: async () => ({ kind: "authorized", user: recruiterUser() }),
            loadRecipientFacts,
        }));

        expect(loadRecipientFacts).toHaveBeenCalledWith("20000000-0000-4000-8000-000000000001");
        expect(screen.getByRole("heading", { name: "Invitations" })).toBeInTheDocument();
        expect(screen.getByText("Irma Castillo")).toBeInTheDocument();
        expect(screen.getByText("2 of 5 answered")).toBeInTheDocument();
        expect(screen.getByText("Email accepted")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /View responses/ })).toHaveAttribute(
            "href",
            "/recruiter/sessions/50000000-0000-4000-8000-000000000001",
        );
        expect(screen.getByRole("link", { name: /Invitation details/ })).toHaveAttribute(
            "href",
            "/recruiter/invitations/30000000-0000-4000-8000-000000000001",
        );
        expect(screen.queryByText("private answer transcript")).not.toBeInTheDocument();
    });

    it("renders an honest empty state", async () => {
        render(await renderRecruiterDashboardRoute({
            resolveAccess: async () => ({ kind: "authorized", user: recruiterUser() }),
            loadRecipientFacts: async () => [],
        }));

        expect(screen.getByRole("heading", { name: "No invitations yet" })).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: /Create invitations/ })).toHaveLength(2);
    });

    it("does not query invitation data for a signed-in user without recruiter access", async () => {
        const loadRecipientFacts = vi.fn();
        render(await renderRecruiterDashboardRoute({
            resolveAccess: async () => ({ kind: "forbidden", user: { ...recruiterUser(), roles: ["qa"] } }),
            loadRecipientFacts,
        }));

        expect(loadRecipientFacts).not.toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: "This account does not have recruiter access." })).toBeInTheDocument();
    });

    it("redirects missing authentication without querying invitation data", async () => {
        const loadRecipientFacts = vi.fn();

        await expect(renderRecruiterDashboardRoute({
            resolveAccess: async () => ({ kind: "missing" }),
            loadRecipientFacts,
        })).rejects.toThrow("redirect:/login?next=%2Frecruiter%2Fdashboard");

        expect(loadRecipientFacts).not.toHaveBeenCalled();
        expect(redirectMock).toHaveBeenCalledWith("/login?next=%2Frecruiter%2Fdashboard");
    });
});

function recruiterUser() {
    return {
        id: "20000000-0000-4000-8000-000000000001",
        email: "recruiter@example.invalid",
        displayName: "Dev Recruiter",
        status: "active" as const,
        roles: ["recruiter" as const],
    };
}

function fact(): RecruiterDashboardRecipientFact {
    return {
        batchId: "30000000-0000-4000-8000-000000000001",
        batchLifecycleState: "ready",
        targetRole: "Quality Inspector",
        interviewStage: "screening",
        batchCreatedAt: "2026-07-20T00:00:00.000Z",
        recipientId: "40000000-0000-4000-8000-000000000001",
        recipientLifecycleState: "ready",
        candidateIndex: 0,
        firstName: "Irma",
        lastName: "Castillo",
        email: "irma@example.invalid",
        requisitionReference: "REQ-1",
        sessionId: "50000000-0000-4000-8000-000000000001",
        sessionStatus: "in_progress",
        sessionAttemptNumber: 1,
        questionCount: 5,
        answeredQuestionCount: 2,
        completedAt: null,
        deliveryLifecycleState: "provider_accepted",
        deliveryAttemptNumber: 1,
        deliveryRetryable: false,
        entryMatchState: "match",
        firstOpenedAt: "2026-07-20T00:10:00.000Z",
        lastActivityAt: "2026-07-20T00:20:00.000Z",
    };
}
