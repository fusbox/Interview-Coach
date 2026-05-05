import { getOptionalServerEnv, isProductionServer } from "@/lib/server/config/server-env";
import { MemoryRateLimitBackend, PostgresRateLimitBackend, SupabaseRateLimitBackend } from "@/lib/server/rate-limit/backend";
import type { RateLimitBackend, RateLimitDecision } from "@/lib/server/rate-limit/types";

type RateLimitBackendName = "memory" | "supabase" | "postgres";

let cachedBackend: RateLimitBackend | null = null;
let cachedBackendName: RateLimitBackendName | null = null;

function resolveBackendName(): RateLimitBackendName {
    const configured = getOptionalServerEnv("RATE_LIMIT_BACKEND");
    if (configured) {
        if (configured === "memory" || configured === "supabase" || configured === "postgres") {
            return configured;
        }

        throw new Error(`Unsupported RATE_LIMIT_BACKEND value: ${configured}`);
    }

    return isProductionServer() ? "supabase" : "memory";
}

function createBackend(name: RateLimitBackendName): RateLimitBackend {
    if (name === "postgres") {
        return new PostgresRateLimitBackend();
    }

    if (name === "supabase") {
        return new SupabaseRateLimitBackend();
    }

    if (isProductionServer()) {
        throw new Error("RATE_LIMIT_BACKEND=memory is not allowed in production.");
    }

    return new MemoryRateLimitBackend();
}

function getBackend(): RateLimitBackend {
    const backendName = resolveBackendName();
    if (!cachedBackend || cachedBackendName !== backendName) {
        cachedBackend = createBackend(backendName);
        cachedBackendName = backendName;
    }

    return cachedBackend;
}

export async function consumeRateLimit(key: string, maxRequests: number, windowMs: number, now: number = Date.now()): Promise<RateLimitDecision> {
    return getBackend().consume({ key, maxRequests, windowMs, now });
}

export async function clearRateLimitBuckets(): Promise<void> {
    if (cachedBackend?.clear) {
        await cachedBackend.clear();
    }

    cachedBackend = null;
    cachedBackendName = null;
}
