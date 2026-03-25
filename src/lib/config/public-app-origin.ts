export const DEFAULT_PUBLIC_APP_ORIGIN = "https://coach.rangam.com";

function getOptionalTrimmedEnv(name: "NEXT_PUBLIC_APP_URL" | "NEXT_PUBLIC_BASE_URL"): string | undefined {
    const rawValue = process.env[name];
    if (typeof rawValue !== "string") {
        return undefined;
    }

    const trimmedValue = rawValue.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function getConfiguredPublicAppOrigin(): string | undefined {
    return getOptionalTrimmedEnv("NEXT_PUBLIC_APP_URL") ?? getOptionalTrimmedEnv("NEXT_PUBLIC_BASE_URL");
}

