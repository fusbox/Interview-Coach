import { getRequiredServerEnv, isProductionServer } from "@/lib/server/config/server-env";
import { DEFAULT_PUBLIC_APP_ORIGIN, getConfiguredPublicAppOrigin } from "@/lib/config/public-app-origin";

const LOCALHOST_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);

function normalizeOrigin(origin: string): string {
    const url = new URL(origin);

    if (LOCALHOST_HOSTS.has(url.hostname)) {
        url.hostname = "localhost";
    }

    return url.origin;
}

function getConfiguredOrigin(): string | undefined {
    const configuredOrigin = getConfiguredPublicAppOrigin();

    if (!configuredOrigin) {
        return undefined;
    }

    return normalizeOrigin(configuredOrigin);
}

export function getAppOrigin(requestUrl?: string): string {
    const configuredOrigin = getConfiguredOrigin();

    if (isProductionServer()) {
        if (configuredOrigin) {
            return configuredOrigin;
        }

        throw new Error(
            "[ServerEnv] Missing required environment variable NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL for public app origin resolution."
        );
    }

    if (configuredOrigin) {
        return configuredOrigin;
    }

    if (requestUrl) {
        return normalizeOrigin(new URL(requestUrl).origin);
    }

    return DEFAULT_PUBLIC_APP_ORIGIN;
}
