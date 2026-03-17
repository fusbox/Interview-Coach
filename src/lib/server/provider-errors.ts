export class ProviderResponseError extends Error {
    readonly provider: string;
    readonly operation: string;

    constructor(provider: string, operation: string, message: string, options?: { cause?: unknown }) {
        super(message);
        this.name = "ProviderResponseError";
        this.provider = provider;
        this.operation = operation;

        if (options?.cause !== undefined) {
            Object.defineProperty(this, "cause", {
                value: options.cause,
                enumerable: false,
                configurable: true
            });
        }
    }
}
