export const PROVIDER_RESPONSE_ERROR_KINDS = [
    "empty_response",
    "invalid_json",
    "schema_validation",
] as const;

export type ProviderResponseErrorKind = (typeof PROVIDER_RESPONSE_ERROR_KINDS)[number];

export class ProviderResponseError extends Error {
    readonly provider: string;
    readonly operation: string;
    readonly kind: ProviderResponseErrorKind;

    constructor(
        provider: string,
        operation: string,
        kind: ProviderResponseErrorKind,
        message: string,
        options?: { cause?: unknown }
    ) {
        super(message);
        this.name = "ProviderResponseError";
        this.provider = provider;
        this.operation = operation;
        this.kind = kind;

        if (options?.cause !== undefined) {
            Object.defineProperty(this, "cause", {
                value: options.cause,
                enumerable: false,
                configurable: true
            });
        }
    }
}
