import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCorrelationId, unauthorizedResponse } from "@/lib/server/api-errors";
import { buildOperationsAlerts } from "@/lib/server/alerts";
import { buildOperationsDashboard, getOperationalMetricsSnapshot, recordAuthDenial } from "@/lib/server/metrics";

export async function GET() {
    const correlationId = createCorrelationId();
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        recordAuthDenial({
            actorType: "recruiter",
            route: "/api/recruiter/ops/metrics",
            reason: "missing_supabase_user"
        });
        return unauthorizedResponse(correlationId, "Authentication required");
    }

    const snapshot = await getOperationalMetricsSnapshot();
    const dashboard = buildOperationsDashboard(snapshot);
    const alerts = buildOperationsAlerts(snapshot);

    return NextResponse.json({
        correlationId,
        snapshot,
        dashboard,
        alerts
    });
}
