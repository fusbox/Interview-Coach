import { z, ZodSchema } from "zod";
import { ProviderResponseError } from "@/lib/server/provider-errors";

type ProviderContext = {
    provider: string;
    operation: string;
};

export function parseProviderJson<T>(
    rawText: string | null | undefined,
    schema: ZodSchema<T>,
    context: ProviderContext
): T {
    if (!rawText) {
        throw new ProviderResponseError(context.provider, context.operation, "Provider returned an empty response");
    }

    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(rawText);
    } catch (error) {
        throw new ProviderResponseError(context.provider, context.operation, "Provider returned invalid JSON", { cause: error });
    }

    return parseProviderValue(parsedJson, schema, context);
}

export function parseProviderValue<T>(
    value: unknown,
    schema: ZodSchema<T>,
    context: ProviderContext
): T {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new ProviderResponseError(context.provider, context.operation, "Provider response failed schema validation", { cause: result.error });
    }

    return result.data;
}

export const NonEmptyProviderTextSchema = z.string().trim().min(1);
