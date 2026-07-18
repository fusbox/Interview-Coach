import type {
    CandidateLaunchContextLookupInput,
    CandidateLaunchContextRow,
} from "./candidate-launch-context";

const SQL_INT_MAX = 2_147_483_647;

export type TalentArborLaunchContextReader = {
    findCandidateById(candidateId: number): Promise<Array<Record<string, unknown>>>;
    findOwnedJobContext(candidateId: number, jobCollectionId: number): Promise<Array<Record<string, unknown>>>;
};

export type TalentArborLaunchContextDiagnostic = {
    operation: "validation" | "candidate_identity" | "owned_job_context";
    reason:
        | "invalid_candidate_id"
        | "invalid_job_collection_id"
        | "candidate_not_found"
        | "job_not_owned_or_catalog_missing"
        | "ambiguous_result"
        | "invalid_result"
        | "query_failed";
};

export function createTalentArborLaunchContextLookup({
    reader,
    onDiagnostic,
}: {
    reader: TalentArborLaunchContextReader;
    onDiagnostic?: (diagnostic: TalentArborLaunchContextDiagnostic) => void;
}) {
    return async function lookupTalentArborLaunchContext(
        input: CandidateLaunchContextLookupInput,
    ): Promise<CandidateLaunchContextRow> {
        const candidateId = parsePositiveSqlInt(input.candidateId);
        if (candidateId === null) {
            emitDiagnostic(onDiagnostic, {
                operation: "validation",
                reason: "invalid_candidate_id",
            });
            return null;
        }

        const normalizedJobCollectionId = input.jobCollectionId?.trim() || null;
        if (!normalizedJobCollectionId) {
            return readIdentityOnlyContext({
                candidateId,
                input,
                reader,
                onDiagnostic,
            });
        }

        const jobCollectionId = parsePositiveSqlInt(normalizedJobCollectionId);
        if (jobCollectionId === null) {
            emitDiagnostic(onDiagnostic, {
                operation: "validation",
                reason: "invalid_job_collection_id",
            });
            return null;
        }

        return readOwnedJobContext({
            candidateId,
            jobCollectionId,
            input,
            reader,
            onDiagnostic,
        });
    };
}

async function readIdentityOnlyContext({
    candidateId,
    input,
    reader,
    onDiagnostic,
}: {
    candidateId: number;
    input: CandidateLaunchContextLookupInput;
    reader: TalentArborLaunchContextReader;
    onDiagnostic?: (diagnostic: TalentArborLaunchContextDiagnostic) => void;
}): Promise<CandidateLaunchContextRow> {
    try {
        const rows = await reader.findCandidateById(candidateId);
        const row = readExactlyOneRow(rows, "candidate_identity", "candidate_not_found", onDiagnostic);
        if (!row) {
            return null;
        }
        const context = toCandidateLaunchContextRow(row, input, candidateId, null);
        if (!context) {
            emitDiagnostic(onDiagnostic, { operation: "candidate_identity", reason: "invalid_result" });
        }
        return context;
    } catch {
        emitDiagnostic(onDiagnostic, {
            operation: "candidate_identity",
            reason: "query_failed",
        });
        return null;
    }
}

async function readOwnedJobContext({
    candidateId,
    jobCollectionId,
    input,
    reader,
    onDiagnostic,
}: {
    candidateId: number;
    jobCollectionId: number;
    input: CandidateLaunchContextLookupInput;
    reader: TalentArborLaunchContextReader;
    onDiagnostic?: (diagnostic: TalentArborLaunchContextDiagnostic) => void;
}): Promise<CandidateLaunchContextRow> {
    try {
        const rows = await reader.findOwnedJobContext(candidateId, jobCollectionId);
        const row = readExactlyOneRow(
            rows,
            "owned_job_context",
            "job_not_owned_or_catalog_missing",
            onDiagnostic,
        );
        if (!row) {
            return null;
        }
        const context = toCandidateLaunchContextRow(row, input, candidateId, jobCollectionId);
        if (!context) {
            emitDiagnostic(onDiagnostic, { operation: "owned_job_context", reason: "invalid_result" });
        }
        return context;
    } catch {
        emitDiagnostic(onDiagnostic, {
            operation: "owned_job_context",
            reason: "query_failed",
        });
        return null;
    }
}

function readExactlyOneRow(
    rows: Array<Record<string, unknown>>,
    operation: TalentArborLaunchContextDiagnostic["operation"],
    emptyReason: TalentArborLaunchContextDiagnostic["reason"],
    onDiagnostic?: (diagnostic: TalentArborLaunchContextDiagnostic) => void,
) {
    if (rows.length === 0) {
        emitDiagnostic(onDiagnostic, { operation, reason: emptyReason });
        return null;
    }
    if (rows.length !== 1) {
        emitDiagnostic(onDiagnostic, { operation, reason: "ambiguous_result" });
        return null;
    }
    return rows[0];
}

function toCandidateLaunchContextRow(
    row: Record<string, unknown>,
    input: CandidateLaunchContextLookupInput,
    expectedCandidateId: number,
    expectedJobCollectionId: number | null,
): Exclude<CandidateLaunchContextRow, null> | null {
    const candidateId = readCanonicalInteger(row.candidateId);
    if (candidateId === null || candidateId !== expectedCandidateId) {
        return null;
    }

    const jobCollectionId = readCanonicalInteger(row.jobCollectionId);
    if (
        (expectedJobCollectionId === null && jobCollectionId !== null)
        || (expectedJobCollectionId !== null && jobCollectionId !== expectedJobCollectionId)
    ) {
        return null;
    }

    return {
        candidateId,
        userId: row.userId,
        companyId: row.companyId,
        email: row.email,
        displayName: row.displayName,
        hostDomain: input.hostDomain,
        sourceSurface: input.sourceSurface,
        talentChannelId: null,
        jobCollectionId,
        requirementId: null,
        requirementCode: null,
        jobTitle: expectedJobCollectionId === null ? null : row.jobTitle,
        jobDescription: expectedJobCollectionId === null ? null : row.jobDescription,
        jobDescriptionSource: expectedJobCollectionId === null ? null : "JobCollection",
        client: expectedJobCollectionId === null ? null : row.client,
        location: expectedJobCollectionId === null ? null : row.location,
        isActive: expectedJobCollectionId === null ? null : row.isActive,
        isExpired: expectedJobCollectionId === null ? null : row.isExpired,
        expirationDate: expectedJobCollectionId === null ? null : normalizeTimestamp(row.expirationDate),
    };
}

function parsePositiveSqlInt(value: string) {
    const normalized = value.trim();
    if (!/^[1-9]\d*$/.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) && parsed <= SQL_INT_MAX ? parsed : null;
}

function readCanonicalInteger(value: unknown) {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) ? value : null;
    }
    if (typeof value === "string") {
        return parsePositiveSqlInt(value);
    }
    return null;
}

function normalizeTimestamp(value: unknown) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    return value;
}

function emitDiagnostic(
    onDiagnostic: ((diagnostic: TalentArborLaunchContextDiagnostic) => void) | undefined,
    diagnostic: TalentArborLaunchContextDiagnostic,
) {
    try {
        onDiagnostic?.(diagnostic);
    } catch {
        // Diagnostics must never change authentication behavior.
    }
}
