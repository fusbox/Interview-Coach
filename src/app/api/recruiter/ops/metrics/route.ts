import { NextResponse } from "next/server";
import { createCorrelationId, internalErrorResponse, unauthorizedResponse } from "@/lib/server/api-errors";
import { buildOperationsAlerts } from "@/lib/server/alerts";
import { createServerLogger } from "@/lib/server/server-logger";
import {
    buildOperationsDashboard,
    getOperationalMetricsSnapshot,
    getOperationalSloSummary
} from "@/lib/server/metrics";
import { sendTriggeredAlertsToTeams } from "@/lib/server/teams-alerts";
import { getAppOrigin } from "@/lib/server/url/get-app-origin";
import { getAuthenticatedRouteUser } from "@/lib/server/auth/current-user";

export async function GET() {
    const correlationId = createCorrelationId();
    const user = await getAuthenticatedRouteUser({
        actorType: "recruiter",
        route: "/api/recruiter/ops/metrics",
    });

    if (!user) {
        return unauthorizedResponse(correlationId, "Authentication required");
    }

    const snapshot = await getOperationalMetricsSnapshot();
    const sloSummary = await getOperationalSloSummary();
    const dashboard = buildOperationsDashboard(snapshot);
    const alerts = buildOperationsAlerts(snapshot);

    return NextResponse.json({
        correlationId,
        snapshot,
        sloSummary,
        dashboard,
        alerts
    });
}

export async function POST(request: Request) {
    const correlationId = createCorrelationId();
    const route = "/api/recruiter/ops/metrics";
    const routeLogger = createServerLogger("RecruiterOpsMetricsNotifyAPI", {
        correlationId,
        route,
        actorType: "recruiter"
    });
    const user = await getAuthenticatedRouteUser({
        actorType: "recruiter",
        route,
    });

    if (!user) {
        return unauthorizedResponse(correlationId, "Authentication required");
    }

    try {
        const snapshot = await getOperationalMetricsSnapshot();
        const alerts = buildOperationsAlerts(snapshot);
        const metricsUrl = `${getAppOrigin(request.url)}/api/recruiter/ops/metrics`;
        const delivery = await sendTriggeredAlertsToTeams({
            alerts,
            correlationId,
            metricsUrl
        });

        return NextResponse.json({
            correlationId,
            delivery,
            metricsUrl
        });
    } catch (error) {
        routeLogger.error("Failed to notify Teams about triggered ops alerts", {
            actorId: user.id,
            error,
            errorCode: "OPS_ALERT_TEAMS_NOTIFY_FAILED"
        });
        return internalErrorResponse(correlationId);
    }
}
