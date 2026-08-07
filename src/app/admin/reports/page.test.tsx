import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppUser } from "@/features/app-auth-v2/app-user";
import type { CandidateEngagementReportRow } from "@/features/candidate-engagement-v2/candidate-engagement-contract";
import { renderAdminReportsRoute } from "./AdminReportsRoute";

const { redirectMock } = vi.hoisted(() => ({
    redirectMock: vi.fn((target: string) => {
        throw new Error(`redirect:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const ADMIN: AppUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.com",
    displayName: "Admin User",
    status: "active",
    roles: ["admin"],
};

const ROW: CandidateEngagementReportRow = {
    candidatePracticeSessionId: "22222222-2222-4222-8222-222222222222",
    candidateLabel: "Devon Carter",
    maskedEmail: "de••••••••@example.com",
    targetRole: "Operations Coordinator",
    sessionStatus: "completed",
    sessionCreatedAt: "2026-08-05T14:00:00.000Z",
    activeMilliseconds: 125_000,
    sliceCount: 14,
    firstReceivedAt: "2026-08-05T14:01:00.000Z",
    lastReceivedAt: "2026-08-05T14:09:00.000Z",
};

describe("administrator reports page", () => {
    it("redirects a missing identity to the shared login", async () => {
        await expect(renderAdminReportsRoute({
            resolveAccess: async () => ({ kind: "missing" }),
        })).rejects.toThrow("redirect:/login?next=%2Fadmin%2Freports");
    });

    it("does not load report data for a non-admin account", async () => {
        const loadEngagementRows = vi.fn();
        render(await renderAdminReportsRoute({
            resolveAccess: async () => ({ kind: "forbidden", user: { ...ADMIN, roles: ["recruiter"] } }),
            loadEngagementRows,
        }));

        expect(screen.getByRole("heading", { name: /does not have reporting access/i })).toBeInTheDocument();
        expect(loadEngagementRows).not.toHaveBeenCalled();
    });

    it("renders only minimized engagement data for an administrator", async () => {
        render(await renderAdminReportsRoute({
            resolveAccess: async () => ({ kind: "authorized", user: ADMIN }),
            loadEngagementRows: async () => [ROW],
        }));

        expect(screen.getByRole("heading", { name: "Candidate engagement" })).toBeInTheDocument();
        expect(screen.getByText("Devon Carter")).toBeInTheDocument();
        expect(screen.getByText("de••••••••@example.com")).toBeInTheDocument();
        expect(screen.getAllByText("2m 5s")).toHaveLength(2);
        expect(screen.queryByText("devon.carter@example.com")).not.toBeInTheDocument();
    });

    it("fails soft when the reporting ledger is unavailable", async () => {
        render(await renderAdminReportsRoute({
            resolveAccess: async () => ({ kind: "authorized", user: ADMIN }),
            loadEngagementRows: async () => { throw new Error("relation unavailable"); },
        }));

        expect(screen.getByRole("heading", { name: "Engagement reporting is unavailable" })).toBeInTheDocument();
    });
});
