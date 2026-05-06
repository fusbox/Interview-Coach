import { getOptionalServerEnv } from "@/lib/server/config/server-env";

export type AppAuthBackendName = "supabase" | "postgres";

export function getAppAuthBackendName(): AppAuthBackendName {
    const configured = getOptionalServerEnv("APP_AUTH_BACKEND")?.toLowerCase();
    if (!configured) {
        return "supabase";
    }

    if (configured === "supabase" || configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported APP_AUTH_BACKEND value "${configured}". Expected "supabase" or "postgres".`);
}
