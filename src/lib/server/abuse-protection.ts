import { Logger } from "@/lib/logger";
import { errorResponse } from "@/lib/server/api-errors";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export function requestIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    return forwarded?.split(",")[0].trim() || "unknown";
}

export function enforceIpRateLimit(params: {
    request: Request;
    scope: string;
    correlationId: string;
    maxRequests: number;
    windowMs: number;
    context?: Record<string, unknown>;
}) {
    const ip = requestIp(params.request);
    const decision = consumeRateLimit(`${params.scope}:ip:${ip}`, params.maxRequests, params.windowMs);

    if (decision.allowed) {
        return null;
    }

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
