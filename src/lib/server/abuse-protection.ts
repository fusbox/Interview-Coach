import { Logger } from "@/lib/logger";
import { errorResponse } from "@/lib/server/api-errors";
import { recordRateLimitDenial } from "@/lib/server/metrics";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export function requestIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    return forwarded?.split(",")[0].trim() || "unknown";
}

export async function enforceIpRateLimit(params: {
    request: Request;
    scope: string;
    correlationId: string;
    maxRequests: number;
    windowMs: number;
    context?: Record<string, unknown>;
    route?: string;
    actorType?: "anonymous" | "candidate" | "recruiter" | "service" | "system";
}) {
    const ip = requestIp(params.request);
    const decision = await consumeRateLimit(`${params.scope}:ip:${ip}`, params.maxRequests, params.windowMs);

    if (decision.allowed) {
        return null;
    }

    recordRateLimitDenial({
        actorType: params.actorType || "anonymous",
        route: params.route || params.scope,
        scope: params.scope
    });

    Logger.warn("Rate limit exceeded", {
        correlationId: params.correlationId,
        scope: params.scope,
        ip,
        ...params.context
    }, "AbuseProtection");

    return errorResponse(429, {
        code: "RATE_LIMITED",
        message: "Rate limit exceeded. Please retry later.",
        correlationId: params.correlationId,
        retryable: true
    });
}
