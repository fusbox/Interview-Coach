import { getOptionalServerEnv } from "@/lib/server/config/server-env";

export type AppAuthBackendName = "postgres";

export function getAppAuthBackendName(): AppAuthBackendName {
    const configured = getOptionalServerEnv("APP_AUTH_BACKEND")?.toLowerCase();
    if (!configured) {
        return "postgres";
    }

    if (configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported APP_AUTH_BACKEND value "${configured}". Expected "postgres".`);
}
