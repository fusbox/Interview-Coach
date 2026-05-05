import { ProviderResponseError } from "@/lib/server/provider-errors";

export function serializeAiQualityError(error: unknown) {
    if (error instanceof ProviderResponseError) {
        return {
            name: error.name,
            message: error.message,
            provider: error.provider,
            operation: error.operation,
            kind: error.kind,
        };
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    return { message: String(error) };
}
