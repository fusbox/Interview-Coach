import { createHash } from "node:crypto";

import { CANDIDATE_SETUP_LIMITS } from "./candidate-setup-contract";

export const CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION = "candidate_resume_text_processing_v1";
export const CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION = "candidate_resume_direct_pii_v5";
export const CANDIDATE_RESUME_TEXT_SOURCE_MAX_LENGTH = 64_000;

export type CandidateResumeTextSource = "pasted_text" | "document_upload" | "photo_capture" | "trusted_host";
export type CandidateResumePiiCategory =
    | "known_name"
    | "personal_detail"
    | "email"
    | "phone"
    | "address"
    | "date_of_birth"
    | "government_identifier"
    | "personal_url_or_handle";

export type CandidateResumePiiRedactionCounts = Record<CandidateResumePiiCategory, number>;

export type CandidateResumeTextProcessingResult = {
    source: CandidateResumeTextSource;
    candidateLabel: string;
    normalizedText: string;
    sourceFingerprint: string;
    normalizedTextFingerprint: string;
    processingPolicyVersion: typeof CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION;
    piiPolicyVersion: typeof CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION;
    piiRedactionCounts: CandidateResumePiiRedactionCounts;
    policyChangedText: boolean;
};

export type CandidateResumeTextProcessingErrorCode =
    | "INVALID_RESUME_TEXT"
    | "RESUME_TOO_LARGE"
    | "EMPTY_EXTRACTION"
    | "PII_PROCESSING_FAILED";

export class CandidateResumeTextProcessingError extends Error {
    readonly code: CandidateResumeTextProcessingErrorCode;

    constructor(code: CandidateResumeTextProcessingErrorCode) {
        super(code);
        this.name = "CandidateResumeTextProcessingError";
        this.code = code;
    }
}

export function processCandidateResumeText(input: {
    source: CandidateResumeTextSource;
    text: unknown;
    candidateLabel?: string | null;
    knownIdentityAliases?: ReadonlyArray<string | null | undefined>;
    sourceFingerprint?: string;
}): CandidateResumeTextProcessingResult {
    if (typeof input.text !== "string") {
        throw new CandidateResumeTextProcessingError("INVALID_RESUME_TEXT");
    }
    if (input.text.length > CANDIDATE_RESUME_TEXT_SOURCE_MAX_LENGTH) {
        throw new CandidateResumeTextProcessingError("RESUME_TOO_LARGE");
    }

    try {
        const sourceNormalizedText = normalizeCandidateResumeText(input.text);
        if (!sourceNormalizedText) {
            throw new CandidateResumeTextProcessingError("EMPTY_EXTRACTION");
        }

        const counts = createEmptyRedactionCounts();
        let processed = sourceNormalizedText;
        processed = replaceResumeContactHeader(processed, counts);
        processed = replaceKnownAliases(processed, input.knownIdentityAliases ?? [], counts);
        processed = replaceMatches(processed, EMAIL_PATTERN, "[Email removed]", counts, "email");
        processed = replaceMatches(processed, URL_PATTERN, "[Profile link removed]", counts, "personal_url_or_handle");
        processed = replaceMatches(processed, HANDLE_PATTERN, "[Profile handle removed]", counts, "personal_url_or_handle");
        processed = replaceMatches(processed, PHONE_PATTERN, "[Phone removed]", counts, "phone", isLikelyPhoneNumber);
        processed = replaceMatches(processed, SSN_PATTERN, "[Government identifier removed]", counts, "government_identifier");
        processed = replaceMatches(
            processed,
            LABELED_IDENTIFIER_PATTERN,
            "$1[Identifier removed]",
            counts,
            "government_identifier",
        );
        processed = replaceMatches(processed, DOB_PATTERN, "$1[Date removed]", counts, "date_of_birth");
        processed = replaceAddressLines(processed, counts);
        processed = normalizeCandidateResumeText(processed);

        if (processed.length > CANDIDATE_SETUP_LIMITS.resumeText) {
            throw new CandidateResumeTextProcessingError("RESUME_TOO_LARGE");
        }
        if (!containsCoachingEvidence(processed)) {
            throw new CandidateResumeTextProcessingError("EMPTY_EXTRACTION");
        }

        return {
            source: input.source,
            candidateLabel: sanitizeCandidateLabel(input.candidateLabel, input.source),
            normalizedText: processed,
            sourceFingerprint: normalizeSourceFingerprint(input.sourceFingerprint) ?? sha256(sourceNormalizedText),
            normalizedTextFingerprint: sha256(processed),
            processingPolicyVersion: CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION,
            piiPolicyVersion: CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION,
            piiRedactionCounts: counts,
            policyChangedText: processed !== sourceNormalizedText,
        };
    } catch (error) {
        if (error instanceof CandidateResumeTextProcessingError) {
            throw error;
        }
        throw new CandidateResumeTextProcessingError("PII_PROCESSING_FAILED");
    }
}

function replaceResumeContactHeader(
    text: string,
    counts: CandidateResumePiiRedactionCounts,
) {
    const lines = text.split("\n");
    const headerIndex = lines.findIndex((line) => line.trim().length > 0);
    if (headerIndex < 0) return text;

    const headerLineIndexes = Array.from(
        { length: Math.min(8, lines.length - headerIndex) },
        (_value, offset) => headerIndex + offset,
    );
    const headerSegments = headerLineIndexes
        .flatMap((index) => splitResumeContactSegments(lines[index]));
    const directContactSignalCount = headerSegments.filter(isResumeContactSegment).length;
    const hasCoarseLocationWithPostalCode = headerSegments
        .some((segment) => COARSE_LOCATION_WITH_POSTAL_PATTERN.test(segment.trim()));
    if (directContactSignalCount < 1 && !hasCoarseLocationWithPostalCode) return text;

    const candidateLineIndex = headerLineIndexes.find((index) => {
        const value = lines[index].trim();
        return value.length > 0 && !RESUME_BOILERPLATE_HEADING_PATTERN.test(value);
    });
    if (candidateLineIndex === undefined) return text;

    const candidateLineSegments = splitResumeContactSegments(lines[candidateLineIndex]);
    const hasDelimitedContactSignal = candidateLineSegments.length > 1
        && candidateLineSegments.slice(1).some((segment) => (
            isResumeContactSegment(segment)
            || COARSE_LOCATION_WITH_POSTAL_PATTERN.test(segment.trim())
        ));
    let removedCandidateDetail = false;
    lines[candidateLineIndex] = candidateLineSegments.map((segment, segmentIndex) => {
        if (!removedCandidateDetail && isLikelyCandidateNameSegment(segment)) {
            removedCandidateDetail = true;
            counts.known_name = Math.min(999, counts.known_name + 1);
            return "[Name removed]";
        }
        if (
            !removedCandidateDetail
            && segmentIndex === 0
            && hasDelimitedContactSignal
            && isAmbiguousPersonalHeaderDetailSegment(segment)
        ) {
            removedCandidateDetail = true;
            counts.personal_detail = Math.min(999, counts.personal_detail + 1);
            return "[Personal detail removed]";
        }
        return segment;
    }).join(" | ");

    return lines.join("\n");
}

export function normalizeCandidateResumeText(value: string) {
    return value
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
        .replace(/\r\n?/g, "\n")
        .replace(/[\t\f\v]+/g, " ")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .split("\n")
        .map((line) => line.replace(/[ \u00A0]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function replaceKnownAliases(
    text: string,
    aliases: ReadonlyArray<string | null | undefined>,
    counts: CandidateResumePiiRedactionCounts,
) {
    const normalizedAliases = Array.from(new Set(aliases
        .map((alias) => typeof alias === "string" ? normalizeCandidateResumeText(alias) : "")
        .filter((alias) => Array.from(alias).length >= 2 && !alias.includes("@"))))
        .sort((left, right) => right.length - left.length);
    const aliasPatternSources = Array.from(new Set(normalizedAliases
        .flatMap(createKnownIdentityAliasPatternSources)))
        .sort((left, right) => right.length - left.length);

    return aliasPatternSources.reduce((current, aliasPatternSource) => {
        const pattern = new RegExp(
            `(^|[^\\p{L}\\p{N}])(?:${aliasPatternSource})(?=$|[^\\p{L}\\p{N}])`,
            "giu",
        );
        return replaceMatches(current, pattern, "$1[Name removed]", counts, "known_name");
    }, text);
}

function createKnownIdentityAliasPatternSources(alias: string) {
    const patterns = [escapeRegExp(alias)];
    if (!CANDIDATE_NAME_SEGMENT_PATTERN.test(alias)) {
        return patterns;
    }

    const commaParts = alias.split(/\s*,\s*/);
    const orderedName = commaParts.length === 2
        ? `${commaParts[1]} ${commaParts[0]}`
        : alias;
    const nameParts = orderedName.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
        return patterns;
    }

    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    const firstInitial = Array.from(firstName)[0];
    const lastInitial = Array.from(lastName)[0];
    if (!firstInitial || !lastInitial) {
        return patterns;
    }

    patterns.push(
        `${escapeRegExp(firstName)}\\s+${escapeRegExp(lastInitial)}\\.?`,
        `${escapeRegExp(firstInitial)}\\.?\\s+${escapeRegExp(lastName)}`,
        `${escapeRegExp(lastName)}\\s*,\\s*${escapeRegExp(firstName)}`,
    );
    return patterns;
}

function replaceAddressLines(text: string, counts: CandidateResumePiiRedactionCounts) {
    const lines = text.split("\n");
    const headerIndex = lines.findIndex((line) => line.trim().length > 0);

    return lines.map((line, lineIndex) => {
        const isHeaderLine = headerIndex >= 0
            && lineIndex >= headerIndex
            && lineIndex < headerIndex + 8;
        const segments = splitResumeContactSegments(line);
        if (segments.length > 1) {
            return segments.map((segment) => {
                return replaceAddressSegment(segment, counts, isHeaderLine);
            }).join(" | ");
        }
        return replaceAddressSegment(line, counts, isHeaderLine);
    }).join("\n");
}

function replaceAddressSegment(
    value: string,
    counts: CandidateResumePiiRedactionCounts,
    allowCoarseLocationPostalCode: boolean,
) {
    if (isLikelyAddress(value)) {
        counts.address = Math.min(999, counts.address + 1);
        return "[Address removed]";
    }

    if (allowCoarseLocationPostalCode) {
        const locationMatch = value.trim().match(COARSE_LOCATION_WITH_POSTAL_PATTERN);
        const coarseLocation = locationMatch?.[1]?.trim();
        if (coarseLocation) {
            counts.address = Math.min(999, counts.address + 1);
            return `${coarseLocation} [Postal code removed]`;
        }
    }

    return value;
}

function splitResumeContactSegments(value: string) {
    return value.split(RESUME_CONTACT_DELIMITER_PATTERN).map((segment) => segment.trim());
}

function isLikelyCandidateNameSegment(value: string) {
    const normalized = value.trim();
    return CANDIDATE_NAME_SEGMENT_PATTERN.test(normalized)
        && !LIKELY_ROLE_OR_SECTION_PATTERN.test(normalized)
        && !isResumeContactSegment(normalized);
}

function isAmbiguousPersonalHeaderDetailSegment(value: string) {
    const normalized = value.trim();
    const letterTokens = normalized.match(LETTER_TOKEN_PATTERN) ?? [];
    return normalized.length <= 80
        && letterTokens.length >= 2
        && letterTokens.length <= 8
        && !DIGIT_PATTERN.test(normalized)
        && !RESUME_BOILERPLATE_HEADING_PATTERN.test(normalized)
        && !LIKELY_ROLE_OR_SECTION_PATTERN.test(normalized)
        && !isResumeContactSegment(normalized);
}

function isResumeContactSegment(value: string) {
    return CONTACT_REDACTION_PLACEHOLDER_PATTERN.test(value)
        || hasMatch(value, EMAIL_PATTERN)
        || hasMatch(value, PHONE_PATTERN)
        || hasMatch(value, URL_PATTERN)
        || hasMatch(value, HANDLE_PATTERN)
        || isLikelyAddress(value);
}

function isLikelyAddress(value: string) {
    const normalized = value.trim().replace(LEADING_CONTACT_DECORATION_PATTERN, "").trim();
    return LABELED_ADDRESS_PATTERN.test(normalized)
        || PO_BOX_PATTERN.test(normalized)
        || STREET_ADDRESS_PATTERN.test(normalized);
}

function hasMatch(value: string, pattern: RegExp) {
    pattern.lastIndex = 0;
    const matched = pattern.test(value);
    pattern.lastIndex = 0;
    return matched;
}

function replaceMatches(
    text: string,
    pattern: RegExp,
    replacement: string,
    counts: CandidateResumePiiRedactionCounts,
    category: CandidateResumePiiCategory,
    shouldReplace?: (match: string) => boolean,
) {
    return text.replace(pattern, (match, ...groups: unknown[]) => {
        if (shouldReplace && !shouldReplace(match)) {
            return match;
        }
        counts[category] = Math.min(999, counts[category] + 1);
        return replacement.replace(/\$(\d+)/g, (_token, index: string) => {
            const value = groups[Number(index) - 1];
            return typeof value === "string" ? value : "";
        });
    });
}

function isLikelyPhoneNumber(value: string) {
    const digitCount = value.replace(/\D/g, "").length;
    return digitCount >= 10 && digitCount <= 15;
}

function containsCoachingEvidence(value: string) {
    const withoutPlaceholders = value.replace(/\[[^\]]+ removed\]/gi, "");
    return (withoutPlaceholders.match(LETTER_OR_NUMBER_PATTERN) ?? []).length >= 8;
}

function sanitizeCandidateLabel(value: string | null | undefined, source: CandidateResumeTextSource) {
    const fallback = source === "trusted_host"
        ? "Resume from connected account"
        : source === "document_upload"
            ? "Uploaded resume"
            : source === "photo_capture"
                ? "Resume photo"
            : "Pasted resume";
    if (typeof value !== "string") {
        return fallback;
    }
    const basename = value.replace(/\\/g, "/").split("/").pop() ?? "";
    const sanitized = normalizeCandidateResumeText(basename)
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .slice(0, 80)
        .trim();
    return sanitized || fallback;
}

function normalizeSourceFingerprint(value: string | undefined) {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function createEmptyRedactionCounts(): CandidateResumePiiRedactionCounts {
    return {
        known_name: 0,
        personal_detail: 0,
        email: 0,
        phone: 0,
        address: 0,
        date_of_birth: 0,
        government_identifier: 0,
        personal_url_or_handle: 0,
    };
}

function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const HANDLE_PATTERN = /(?<![\w@])@[A-Z0-9_][A-Z0-9_.-]{1,38}\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}|\+\d{1,3}[ .-]?(?:\d[ .-]?){8,12}\d)(?:\s*(?:x|ext\.?)[ .-]?\d{1,6})?(?!\d)/gi;
const SSN_PATTERN = /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g;
const LABELED_IDENTIFIER_PATTERN = /\b((?:ssn|social security|passport|driver'?s? license|national id|account id|candidate id)\s*(?::|#|-)?\s*)[A-Z0-9-]{4,}\b/gi;
const DOB_PATTERN = /\b((?:date of birth|birth date|dob)\s*(?::|-)?\s*)(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|[A-Z]+\s+\d{1,2},?\s+\d{4})\b/gi;
const CONTACT_REDACTION_PLACEHOLDER_PATTERN = /^\[(?:Email|Phone|Profile link|Profile handle|Address|Personal detail) removed\]$/i;
const CANDIDATE_NAME_SEGMENT_PATTERN = new RegExp(
    "^[\\p{L}\\p{M}][\\p{L}\\p{M}'\\u2019.-]*(?:,?\\s+[\\p{L}\\p{M}][\\p{L}\\p{M}'\\u2019.-]*){1,5}$",
    "u",
);
const RESUME_CONTACT_DELIMITER_PATTERN = /\s*(?:\||\u2022|\u00b7|\u25cf|\u25aa|\u25e6)\s*/;
const RESUME_BOILERPLATE_HEADING_PATTERN = /^(?:resume|curriculum vitae|cv)$/i;
const LIKELY_ROLE_OR_SECTION_PATTERN = /\b(?:accountant|administrator|agent|analyst|assembler|assistant|associate|auditor|buyer|care|cashier|chef|clerk|college|company|consultant|consultants|controller|coordinator|corporation|customer|designer|developer|director|driver|educator|electrician|engineer|executive|finance|handler|hospital|human|inc|inspector|installer|investigator|janitor|laborer|lead|leader|llc|logistics|machinist|maintenance|management|manager|manufacturing|marketing|mechanic|nurse|objective|officer|operator|packer|plumber|processor|production|profile|project|quality|recruiter|representative|resources|sales|school|scientist|security|server|services|solutions|specialist|success|summary|supervisor|support|teacher|technician|technologies|university|welder|writer)\b/i;
const COARSE_LOCATION_WITH_POSTAL_PATTERN = new RegExp(
    "^([\\p{L}\\p{M}][\\p{L}\\p{M} .'\\u2019-]{1,60},\\s*[\\p{L}\\p{M}]{2,30})\\s+"
    + "(?:\\d{4,6}(?:-\\d{3,4})?|[A-Z]\\d[A-Z][ -]?\\d[A-Z]\\d)$",
    "iu",
);
const LEADING_CONTACT_DECORATION_PATTERN = /^(?:[\s|:\-]|\u2022|\u00b7|\u25cf|\u25aa|\u25e6)+/;
const LABELED_ADDRESS_PATTERN = /^(?:(?:home|mailing|postal|street|residential|current|permanent)\s+)?address\s*(?::|#|-)\s*\S.+$/i;
const PO_BOX_PATTERN = /^P\.?\s*O\.?\s+Box\s+\d+/i;
const STREET_ADDRESS_PATTERN = new RegExp(
    "^(?:(?:flat|apt|apartment|unit|suite|floor|building|house|plot)\\s*[\\p{L}\\p{N}#-]+[,\\s]+)?"
    + "\\d{1,6}\\s+[\\p{L}\\p{N}.'# -]{2,80}\\b"
    + "(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|parkway|pkwy|highway|hwy|terrace|ter|place|pl|way|marg|nagar|rue|strasse|straße)\\b"
    + "(?:[ ,.\\p{L}\\p{N}#-]*)$",
    "iu",
);
const LETTER_OR_NUMBER_PATTERN = new RegExp("[\\p{L}\\p{N}]", "gu");
const LETTER_TOKEN_PATTERN = new RegExp("[\\p{L}\\p{M}][\\p{L}\\p{M}'\\u2019-]*", "gu");
const DIGIT_PATTERN = /\d/;
