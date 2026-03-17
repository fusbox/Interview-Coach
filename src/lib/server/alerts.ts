import { MetricsSnapshot, buildOperationsDashboard } from "@/lib/server/metrics";

export type AlertSeverity = "warning" | "critical";
export type AlertRoute = "engineering-on-call" | "backend-primary" | "product-owner";
export type AlertId =
    | "invite_delivery_failures"
    | "auth_abuse_spike"
    | "ai_error_spike"
    | "ai_latency_spike"
    | "session_completion_stall";

export type OperationsAlert = {
    id: AlertId;
    severity: AlertSeverity;
    title: string;
    summary: string;
    runbookSlug: string;
    routes: AlertRoute[];
    triggered: boolean;
    metadata: Record<string, number | string>;
};

const AI_ERROR_THRESHOLD = 5;
const AI_ERROR_RATE_THRESHOLD = 0.2;
const AI_LATENCY_WARNING_MS = 4000;
const AI_LATENCY_CRITICAL_MS = 8000;
const INVITE_FAILURE_THRESHOLD = 3;
const AUTH_DENIAL_THRESHOLD = 10;
const RATE_LIMIT_DENIAL_THRESHOLD = 10;
const SESSION_STALL_START_THRESHOLD = 5;

export function buildOperationsAlerts(snapshot: MetricsSnapshot): OperationsAlert[] {
    const dashboard = buildOperationsDashboard(snapshot);
    const inviteAttempts = dashboard.invites.sendSuccesses + dashboard.invites.sendFailures;
    const inviteFailureRate = inviteAttempts === 0 ? 0 : dashboard.invites.sendFailures / inviteAttempts;
    const aiAttempts = dashboard.ai.requests + dashboard.ai.errors;
    const aiErrorRate = aiAttempts === 0 ? 0 : dashboard.ai.errors / aiAttempts;
    const highestAiLatency = dashboard.ai.operations.reduce((max, operation) => Math.max(max, operation.maxLatencyMs), 0);
    const avgAiLatency = dashboard.ai.operations.reduce((max, operation) => Math.max(max, operation.avgLatencyMs), 0);

    return [
        {
            id: "invite_delivery_failures",
            severity: dashboard.invites.sendFailures >= INVITE_FAILURE_THRESHOLD && inviteFailureRate >= 0.3 ? "critical" : "warning",
            title: "Invite delivery failures",
            summary: "Candidate invite sends are failing often enough to impact recruiter workflows.",
            runbookSlug: "invite-delivery-failures",
            routes: ["backend-primary", "product-owner"],
            triggered: dashboard.invites.sendFailures >= INVITE_FAILURE_THRESHOLD,
            metadata: {
                sendFailures: dashboard.invites.sendFailures,
                sendSuccesses: dashboard.invites.sendSuccesses,
                failureRate: Number(inviteFailureRate.toFixed(2))
            }
        },
        {
            id: "auth_abuse_spike",
            severity: dashboard.security.rateLimitDenials >= RATE_LIMIT_DENIAL_THRESHOLD ? "critical" : "warning",
            title: "Authentication or abuse spike",
            summary: "Auth denials or rate-limit denials are above the expected baseline.",
            runbookSlug: "auth-abuse-spike",
            routes: ["engineering-on-call", "backend-primary"],
            triggered: dashboard.security.authDenials >= AUTH_DENIAL_THRESHOLD
                || dashboard.security.rateLimitDenials >= RATE_LIMIT_DENIAL_THRESHOLD,
            metadata: {
                authDenials: dashboard.security.authDenials,
                rateLimitDenials: dashboard.security.rateLimitDenials
            }
        },
        {
            id: "ai_error_spike",
            severity: dashboard.ai.errors >= AI_ERROR_THRESHOLD && aiErrorRate >= AI_ERROR_RATE_THRESHOLD ? "critical" : "warning",
            title: "AI provider error spike",
            summary: "AI-backed coaching flows are returning errors above the tolerated threshold.",
            runbookSlug: "ai-error-spike",
            routes: ["engineering-on-call", "backend-primary"],
            triggered: dashboard.ai.errors >= AI_ERROR_THRESHOLD,
            metadata: {
                aiErrors: dashboard.ai.errors,
                aiRequests: dashboard.ai.requests,
                errorRate: Number(aiErrorRate.toFixed(2))
            }
        },
        {
            id: "ai_latency_spike",
            severity: highestAiLatency >= AI_LATENCY_CRITICAL_MS ? "critical" : "warning",
            title: "AI latency spike",
            summary: "One or more AI operations are responding slower than the expected experience budget.",
            runbookSlug: "ai-latency-spike",
            routes: ["engineering-on-call", "backend-primary"],
            triggered: avgAiLatency >= AI_LATENCY_WARNING_MS || highestAiLatency >= AI_LATENCY_CRITICAL_MS,
            metadata: {
                highestOperationLatencyMs: highestAiLatency,
                highestAverageLatencyMs: Number(avgAiLatency.toFixed(2))
            }
        },
        {
            id: "session_completion_stall",
            severity: dashboard.sessions.starts >= SESSION_STALL_START_THRESHOLD && dashboard.sessions.completions === 0 ? "critical" : "warning",
            title: "Session funnel stall",
            summary: "Candidates are starting sessions but not reaching completion.",
            runbookSlug: "session-completion-stall",
            routes: ["product-owner", "backend-primary"],
            triggered: dashboard.sessions.starts >= SESSION_STALL_START_THRESHOLD && dashboard.sessions.completions === 0,
            metadata: {
                sessionStarts: dashboard.sessions.starts,
                sessionCompletions: dashboard.sessions.completions,
                repeatStarts: dashboard.sessions.repeatStarts
            }
        }
    ];
}
