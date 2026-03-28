import { beforeEach, describe, expect, it } from "vitest";
import { buildOperationsAlerts } from "./alerts";
import { getMetricsSnapshot, incrementMetric, observeMetric, resetMetrics } from "./metrics";

describe("operations alerts", () => {
    beforeEach(() => {
        resetMetrics();
    });

    it("does not trigger alerts when metrics are healthy", () => {
        incrementMetric("invite_send_total", { outcome: "success" }, 5);
        incrementMetric("invite_resend_total", { outcome: "success" }, 2);
        incrementMetric("recruiter_invite_create_total", { outcome: "success" }, 2);
        incrementMetric("session_start_total", { outcome: "success", mode: "new" }, 3);
        incrementMetric("session_completion_total", { outcome: "success" }, 2);
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "success" }, 4);
        observeMetric("ai_request_duration_ms", 900, { operation: "analysis", outcome: "success" });

        const alerts = buildOperationsAlerts(getMetricsSnapshot());

        expect(alerts.every((alert) => !alert.triggered)).toBe(true);
    });

    it("triggers invite, auth, AI, latency, and stall alerts at threshold", () => {
        incrementMetric("invite_send_total", { outcome: "error" }, 2);
        incrementMetric("invite_send_total", { outcome: "success" }, 2);
        incrementMetric("invite_resend_total", { outcome: "error" }, 2);
        incrementMetric("auth_denials_total", { actorType: "candidate" }, 12);
        incrementMetric("rate_limit_denials_total", { scope: "analysis" }, 11);
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "error" }, 6);
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "success" }, 2);
        observeMetric("ai_request_duration_ms", 8200, { operation: "analysis", outcome: "error" });
        incrementMetric("session_start_total", { outcome: "success", mode: "new" }, 6);

        const alerts = buildOperationsAlerts(getMetricsSnapshot());
        const triggeredIds = alerts.filter((alert) => alert.triggered).map((alert) => alert.id);

        expect(triggeredIds).toEqual(expect.arrayContaining([
            "invite_delivery_failures",
            "auth_abuse_spike",
            "ai_error_spike",
            "ai_latency_spike",
            "session_completion_stall"
        ]));
    });
});
