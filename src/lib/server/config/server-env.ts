const MISSING_ENV_PREFIX = "[ServerEnv]";

export function isProductionServer(): boolean {
    return process.env.NODE_ENV === "production";
}

export function getOptionalServerEnv(name: string): string | undefined {
    const rawValue = process.env[name];
    if (typeof rawValue !== "string") {
        return undefined;
    }

    const trimmedValue = rawValue.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function getRequiredServerEnv(name: string, context?: string): string {
    const value = getOptionalServerEnv(name);
    if (!value) {
        const scope = context ? ` for ${context}` : "";
        throw new Error(`${MISSING_ENV_PREFIX} Missing required environment variable ${name}${scope}.`);
    }

    return value;
}

export function assertProductionServerEnv(names: string[], context: string): void {
    if (!isProductionServer()) {
        return;
    }

    for (const name of names) {
        getRequiredServerEnv(name, context);
    }
}
