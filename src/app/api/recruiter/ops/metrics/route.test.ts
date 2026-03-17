import { beforeEach, describe, expect, it, vi } from "vitest";
import { incrementMetric, resetMetrics } from "@/lib/server/metrics";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: () => ({
        auth: {
            getUser: getUserMock
        }
    })
}));

describe("GET /api/recruiter/ops/metrics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
        getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    });

    it("returns 401 when unauthenticated", async () => {
        getUserMock.mockResolvedValue({ data: { user: null }, error: null });
        const { GET } = await import("./route");

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.code).toBe("UNAUTHORIZED");
    });

    it("returns the current metrics snapshot and dashboard", async () => {
        incrementMetric("invite_send_total", { outcome: "success" });
        incrementMetric("session_completion_total", { outcome: "success" });
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "error" });

        const { GET } = await import("./route");
        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.correlationId).toBeDefined();
        expect(body.snapshot.counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_send_total",
                tags: { outcome: "success" },
                value: 1
            })
        ]));
        expect(body.dashboard.invites.sendSuccesses).toBe(1);
        expect(body.dashboard.sessions.completions).toBe(1);
        expect(body.dashboard.ai.errors).toBe(1);
        expect(body.alerts).toEqual(expect.any(Array));
    });

    it("returns triggered alerts when thresholds are exceeded", async () => {
        incrementMetric("invite_send_total", { outcome: "error" }, 4);
        incrementMetric("auth_denials_total", { actorType: "candidate" }, 12);

        const { GET } = await import("./route");
        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.alerts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: "invite_delivery_failures",
                triggered: true
            }),
            expect.objectContaining({
                id: "auth_abuse_spike",
                triggered: true
            })
        ]));
    });
});
