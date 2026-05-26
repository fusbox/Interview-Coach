import { NextResponse } from "next/server";

const retiredAnalysisRouteResponse = () => NextResponse.json(
    {
        code: "ROUTE_RETIRED",
        message: "This analysis endpoint is retired. Use the session-scoped question analysis route.",
        retryable: false,
        replacement: "/api/session/[session_id]/questions/[question_id]/analysis",
    },
    {
        status: 410,
        headers: {
            "Cache-Control": "no-store",
        },
    }
);

export async function POST() {
    return retiredAnalysisRouteResponse();
}

export async function GET() {
    return retiredAnalysisRouteResponse();
}
