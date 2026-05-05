export type PiiReplacement = {
    value?: string | null;
    label: string;
};

export type RedactPiiOptions = {
    replacements?: PiiReplacement[];
};

const SENSITIVE_FIELD_LABELS: Record<string, string> = {
    firstname: "FIRST_NAME",
    first_name: "FIRST_NAME",
    lastname: "LAST_NAME",
    last_name: "LAST_NAME",
    fullname: "CANDIDATE_NAME",
    full_name: "CANDIDATE_NAME",
    candidatename: "CANDIDATE_NAME",
    candidate_name: "CANDIDATE_NAME",
    city: "LOCATION",
    state: "LOCATION",
    zip: "LOCATION",
    zipcode: "LOCATION",
    zip_code: "LOCATION",
    postalcode: "LOCATION",
    postal_code: "LOCATION",
    address: "ADDRESS",
    streetaddress: "ADDRESS",
    street_address: "ADDRESS",
    company: "ORGANIZATION",
    companyname: "ORGANIZATION",
    company_name: "ORGANIZATION",
    employer: "ORGANIZATION",
    employername: "ORGANIZATION",
    employer_name: "ORGANIZATION",
    organization: "ORGANIZATION",
    organizationname: "ORGANIZATION",
    organization_name: "ORGANIZATION",
    clientname: "ORGANIZATION",
    client_name: "ORGANIZATION",
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const ADDRESS_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Parkway|Pkwy|Place|Pl)\b(?:[.,]?\s*(?:Apt|Apartment|Unit|Suite|Ste|#)\s*\w+)?/gi;
const CITY_STATE_ZIP_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g;
const ORGANIZATION_PATTERN = /\b[A-Z][A-Za-z'&.-]+(?:\s+[A-Z][A-Za-z'&.-]+){0,4}\s+(?:Clinic|Hospital|Health|Healthcare|Medical|Inc|LLC|Corp|Corporation|Company|Co|University|College|School|Bank|Credit Union|Warehouse|Factory|Logistics|Technologies|Technology|Systems|Solutions|Services)\b/g;

export function redactPii<T>(value: T, options: RedactPiiOptions = {}): T {
    const replacements = mergeReplacements([
        ...(options.replacements ?? []),
        ...collectKnownPiiReplacements(value),
    ]);

    return redactPiiValue(value, { ...options, replacements });
}

function redactPiiValue<T>(value: T, options: RedactPiiOptions): T {
    if (typeof value === "string") {
        return redactPiiString(value, options) as T;
    }

    if (Array.isArray(value)) {
        return value.map(item => redactPiiValue(item, options)) as T;
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
                key,
                redactPiiValue(nested, options),
            ])
        ) as T;
    }

    return value;
}

export function redactPiiString(value: string, options: RedactPiiOptions = {}): string {
    let redacted = value
        .replace(EMAIL_PATTERN, "[EMAIL]")
        .replace(PHONE_PATTERN, "[PHONE]")
        .replace(SSN_PATTERN, "[SSN]")
        .replace(ADDRESS_PATTERN, "[ADDRESS]")
        .replace(CITY_STATE_ZIP_PATTERN, "[LOCATION]")
        .replace(ORGANIZATION_PATTERN, "[ORGANIZATION]");

    const sortedReplacements = [...(options.replacements ?? [])]
        .sort((left, right) => (right.value?.length ?? 0) - (left.value?.length ?? 0));

    for (const replacement of sortedReplacements) {
        const rawValue = replacement.value?.trim();
        if (!rawValue || rawValue.length < 2) continue;

        redacted = redacted.replace(
            buildReplacementPattern(rawValue),
            `[${replacement.label}]`
        );
    }

    return redacted;
}

function collectKnownPiiReplacements(value: unknown): PiiReplacement[] {
    const replacements: PiiReplacement[] = [];

    collectKnownPiiReplacementsInto(value, replacements);
    return replacements;
}

function collectKnownPiiReplacementsInto(value: unknown, replacements: PiiReplacement[]) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
        value.forEach(item => collectKnownPiiReplacementsInto(item, replacements));
        return;
    }

    const record = value as Record<string, unknown>;
    const firstName = asString(record.firstName ?? record.first_name);
    const lastName = asString(record.lastName ?? record.last_name);
    if (firstName && lastName) {
        replacements.push({ value: `${firstName} ${lastName}`, label: "CANDIDATE_NAME" });
    }

    for (const [key, nested] of Object.entries(record)) {
        const label = SENSITIVE_FIELD_LABELS[normalizeFieldName(key)];
        const rawValue = asString(nested);
        if (label && rawValue) {
            replacements.push({ value: rawValue, label });
        }

        collectKnownPiiReplacementsInto(nested, replacements);
    }
}

function mergeReplacements(replacements: PiiReplacement[]): PiiReplacement[] {
    const seen = new Set<string>();
    const merged: PiiReplacement[] = [];

    for (const replacement of replacements) {
        const rawValue = replacement.value?.trim();
        if (!rawValue || rawValue.length < 2) continue;

        const key = `${replacement.label}:${rawValue.toLowerCase()}`;
        if (seen.has(key)) continue;

        seen.add(key);
        merged.push({ value: rawValue, label: replacement.label });
    }

    return merged;
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeFieldName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function buildReplacementPattern(rawValue: string): RegExp {
    const escaped = escapeRegExp(rawValue);
    const startsWithWord = /^[A-Za-z0-9]/.test(rawValue);
    const endsWithWord = /[A-Za-z0-9]$/.test(rawValue);
    const prefix = startsWithWord ? "\\b" : "";
    const suffix = endsWithWord ? "\\b" : "";

    return new RegExp(`${prefix}${escaped}${suffix}`, "gi");
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
