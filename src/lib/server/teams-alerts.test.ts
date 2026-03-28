import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationsAlert } from "@/lib/server/alerts";
import { buildTeamsAlertCard, sendTriggeredAlertsToTeams } from "./teams-alerts";

const originalEnv = { ...process.env };

function makeAlert(overrides?: Partial<OperationsAlert>): OperationsAlert {
    return {
        id: "ai_latency_spike",
        severity: "critical",
        title: "AI latency spike",
        summary: "One or more AI operations are responding slower than expected.",
        runbookSlug: "ai-latency-spike",
        routes: ["engineering-on-call", "backend-primary"],
        triggered: true,
        metadata: {
            highestOperationLatencyMs: 15605,
            highestAverageLatencyMs: 14228.25
        },
        ...overrides
    };
}

describe("teams alert notifications", () => {
    beforeEach(() => {
        process.env = { ...originalEnv };
        vi.restoreAllMocks();
    });

    it("builds a Teams message card for triggered alerts", () => {
        const card = buildTeamsAlertCard({
            alerts: [makeAlert()],
            correlationId: "corr-123",
            metricsUrl: "https://example.com/api/recruiter/ops/metrics"
        });

        expect(card.title).toContain("Interview Coach alert notification");
        expect(card.themeColor).toBe("C62828");
        expect(card.sections[0]).toMatchObject({
            activityTitle: "AI latency spike",
            markdown: true
        });
        expect(card.sections[0].facts).toEqual(expect.arrayContaining([
            { name: "Routes", value: "engineering-on-call, backend-primary" },
            { name: "Runbook", value: "ai-latency-spike" }
        ]));
    });

    it("skips delivery when no triggered alerts exist", async () => {
        const result = await sendTriggeredAlertsToTeams({
            alerts: [makeAlert({ triggered: false })],
            correlationId: "corr-123",
            metricsUrl: "https://example.com/api/recruiter/ops/metrics"
        });

        expect(result).toEqual({
            status: "no_triggered_alerts",
            triggeredAlertIds: [],
            deliveredAlertIds: []
        });
    });

    it("skips delivery when the Teams webhook is not configured", async () => {
        delete process.env.TEAMS_ALERT_WEBHOOK_URL;

        const result = await sendTriggeredAlertsToTeams({
            alerts: [makeAlert()],
            correlationId: "corr-123",
            metricsUrl: "https://example.com/api/recruiter/ops/metrics"
        });

        expect(result).toEqual({
            status: "webhook_not_configured",
            triggeredAlertIds: ["ai_latency_spike"],
            deliveredAlertIds: []
        });
    });

    it("posts triggered alerts to Teams when the webhook is configured", async () => {
        process.env.TEAMS_ALERT_WEBHOOK_URL = "https://teams.example/webhook";
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal("fetch", fetchMock);

        const result = await sendTriggeredAlertsToTeams({
            alerts: [makeAlert()],
            correlationId: "corr-123",
            metricsUrl: "https://example.com/api/recruiter/ops/metrics"
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://teams.example/webhook",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" }
            })
        );
        expect(result).toEqual({
            status: "sent",
            triggeredAlertIds: ["ai_latency_spike"],
            deliveredAlertIds: ["ai_latency_spike"]
        });
    });
});
