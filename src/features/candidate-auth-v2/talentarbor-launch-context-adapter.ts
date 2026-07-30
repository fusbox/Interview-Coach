import {
    htmlResumeToPlainText,
    type CandidateLaunchContextLookupInput,
    type CandidateLaunchContextRow,
} from "./candidate-launch-context";

const SQL_INT_MAX = 2_147_483_647;
const REQUIREMENT_CATALOG_PREFIX = "rm:";

export type TalentArborLaunchContextReader = {
    findCandidateById(candidateId: number): Promise<Array<Record<string, unknown>>>;
    findJobCollectionById(candidateId: number, jobCollectionId: number): Promise<Array<Record<string, unknown>>>;
    findRequirementById(input: {
        candidateId: number;
        requirementId: number;
        clientId: number;
        talentChannelId: number;
    }): Promise<Array<Record<string, unknown>>>;
    findCandidateResumeHtml?(candidateId: number): Promise<Array<Record<string, unknown>>>;
};

export type TalentArborLaunchContextDiagnostic = {
    operation: "validation" | "candidate_identity" | "owned_job_context" | "resume_prefetch";
    reason:
        | "invalid_candidate_id"
        | "invalid_job_collection_id"
        | "invalid_requirement_id"
        | "invalid_client_id"
        | "invalid_talent_channel_id"
        | "candidate_not_found"
        | "job_not_owned_or_catalog_missing"
        | "ambiguous_result"
        | "invalid_result"
        | "query_failed"
        | "resume_unavailable";
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

        const jobHint = resolveJobLookupHint(input);
        if (jobHint === "invalid") {
            return null;
        }
        if (!jobHint) {
            return readIdentityOnlyContext({
                candidateId,
                input,
                reader,
                onDiagnostic,
            });
        }

        if (jobHint.kind === "job_collection") {
            return readJobCollectionContext({
                candidateId,
                jobCollectionId: jobHint.jobCollectionId,
                input,
                reader,
                onDiagnostic,
            });
        }

        return readRequirementContext({
            candidateId,
            requirementId: jobHint.requirementId,
            clientId: jobHint.clientId,
            talentChannelId: jobHint.talentChannelId,
            input,
            reader,
            onDiagnostic,
        });
    };

    function resolveJobLookupHint(input: CandidateLaunchContextLookupInput):
        | null
        | "invalid"
        | { kind: "job_collection"; jobCollectionId: number }
        | {
            kind: "requirement";
            requirementId: number;
            clientId: number;
            talentChannelId: number;
        } {
        const talentChannelRaw = input.talentChannelId?.trim() || null;
        const requirementRaw = input.requirementId?.trim() || null;
        const jobCollectionRaw = input.jobCollectionId?.trim() || null;
        const clientRaw = input.clientId?.trim() || null;

        if (!talentChannelRaw && !requirementRaw && !jobCollectionRaw) {
            return null;
        }

        const talentChannelId = talentChannelRaw === null
            ? (jobCollectionRaw ? 0 : null)
            : parseNonNegativeSqlInt(talentChannelRaw);

        if (talentChannelRaw !== null && talentChannelId === null) {
            emitDiagnostic(onDiagnostic, {
                operation: "validation",
                reason: "invalid_talent_channel_id",
            });
            return "invalid";
        }

        if (talentChannelId === null || talentChannelId === 0) {
            const jobCollectionId = parsePositiveSqlInt(jobCollectionRaw ?? requirementRaw ?? "");
            if (jobCollectionId === null) {
                emitDiagnostic(onDiagnostic, {
                    operation: "validation",
                    reason: "invalid_job_collection_id",
                });
                return "invalid";
            }
            return { kind: "job_collection", jobCollectionId };
        }

        const requirementId = parsePositiveSqlInt(requirementRaw ?? "");
        if (requirementId === null) {
            emitDiagnostic(onDiagnostic, {
                operation: "validation",
                reason: "invalid_requirement_id",
            });
            return "invalid";
        }
        const clientId = parsePositiveSqlInt(clientRaw ?? "");
        if (clientId === null) {
            emitDiagnostic(onDiagnostic, {
                operation: "validation",
                reason: "invalid_client_id",
            });
            return "invalid";
        }
        return {
            kind: "requirement",
            requirementId,
            clientId,
            talentChannelId,
        };
    }
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
        const context = toCandidateLaunchContextRow({
            row,
            input,
            expectedCandidateId: candidateId,
            expectedJobCollectionId: null,
            expectedRequirementId: null,
            jobDescriptionSource: null,
            talentChannelId: null,
        });
        if (!context) {
            emitDiagnostic(onDiagnostic, { operation: "candidate_identity", reason: "invalid_result" });
            return null;
        }
        return attachResume(context, candidateId, reader, onDiagnostic);
    } catch {
        emitDiagnostic(onDiagnostic, {
            operation: "candidate_identity",
            reason: "query_failed",
        });
        return null;
    }
}

async function readJobCollectionContext({
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
        const identityRows = await reader.findCandidateById(candidateId);
        const identity = readExactlyOneRow(
            identityRows,
            "candidate_identity",
            "candidate_not_found",
            onDiagnostic,
        );
        if (!identity) {
            return null;
        }

        const jobRows = await reader.findJobCollectionById(candidateId, jobCollectionId);
        const job = readExactlyOneRow(
            jobRows,
            "owned_job_context",
            "job_not_owned_or_catalog_missing",
            onDiagnostic,
        );
        if (!job) {
            return null;
        }

        const context = toCandidateLaunchContextRow({
            row: {
                ...identity,
                ...job,
                candidateId: identity.candidateId ?? candidateId,
                jobCollectionId: job.JobCollectionID ?? job.jobCollectionId ?? jobCollectionId,
                jobTitle: job.JobTitle ?? job.jobTitle,
                jobDescription: job.JobDescription ?? job.jobDescription,
                client: job.Client ?? job.client,
                location: job.Location ?? job.location,
                isActive: job.IsActive ?? job.isActive,
                isExpired: job.IsExpired ?? job.isExpired,
                expirationDate: job.ExpirationDate ?? job.expirationDate,
            },
            input,
            expectedCandidateId: candidateId,
            expectedJobCollectionId: jobCollectionId,
            expectedRequirementId: null,
            jobDescriptionSource: "JobCollection",
            talentChannelId: 0,
        });
        if (!context) {
            emitDiagnostic(onDiagnostic, { operation: "owned_job_context", reason: "invalid_result" });
            return null;
        }
        return attachResume(context, candidateId, reader, onDiagnostic);
    } catch {
        emitDiagnostic(onDiagnostic, {
            operation: "owned_job_context",
            reason: "query_failed",
        });
        return null;
    }
}

async function readRequirementContext({
    candidateId,
    requirementId,
    clientId,
    talentChannelId,
    input,
    reader,
    onDiagnostic,
}: {
    candidateId: number;
    requirementId: number;
    clientId: number;
    talentChannelId: number;
    input: CandidateLaunchContextLookupInput;
    reader: TalentArborLaunchContextReader;
    onDiagnostic?: (diagnostic: TalentArborLaunchContextDiagnostic) => void;
}): Promise<CandidateLaunchContextRow> {
    try {
        const identityRows = await reader.findCandidateById(candidateId);
        const identity = readExactlyOneRow(
            identityRows,
            "candidate_identity",
            "candidate_not_found",
            onDiagnostic,
        );
        if (!identity) {
            return null;
        }

        const jobRows = await reader.findRequirementById({
            candidateId,
            requirementId,
            clientId,
            talentChannelId,
        });
        const job = readExactlyOneRow(
            jobRows,
            "owned_job_context",
            "job_not_owned_or_catalog_missing",
            onDiagnostic,
        );
        if (!job) {
            return null;
        }

        const context = toCandidateLaunchContextRow({
            row: {
                ...identity,
                ...job,
                candidateId: identity.candidateId ?? candidateId,
                jobCollectionId: `${REQUIREMENT_CATALOG_PREFIX}${requirementId}`,
                requirementId: job.RequirementID ?? job.requirementId ?? requirementId,
                requirementCode: job.RequirementCode ?? job.requirementCode,
                jobTitle: job.JobTitleText ?? job.jobTitle,
                jobDescription: job.RequirementJobDescription ?? job.jobDescription,
                client: job.ClientName ?? job.client,
                location: job.Location ?? job.location,
                isActive: job.IsActive ?? job.isActive ?? null,
                isExpired: job.IsExpired ?? job.isExpired ?? null,
                expirationDate: job.RequirementCloseTentativeDate ?? job.expirationDate ?? null,
            },
            input,
            expectedCandidateId: candidateId,
            expectedJobCollectionId: null,
            expectedRequirementId: requirementId,
            jobDescriptionSource: "RequirementMaster",
            talentChannelId,
            allowRequirementCatalogKey: true,
        });
        if (!context) {
            emitDiagnostic(onDiagnostic, { operation: "owned_job_context", reason: "invalid_result" });
            return null;
        }
        return attachResume(context, candidateId, reader, onDiagnostic);
    } catch {
        emitDiagnostic(onDiagnostic, {
            operation: "owned_job_context",
            reason: "query_failed",
        });
        return null;
    }
}

async function attachResume(
    context: Exclude<CandidateLaunchContextRow, null>,
    candidateId: number,
    reader: TalentArborLaunchContextReader,
    onDiagnostic?: (diagnostic: TalentArborLaunchContextDiagnostic) => void,
): Promise<Exclude<CandidateLaunchContextRow, null>> {
    if (!reader.findCandidateResumeHtml) {
        return context;
    }

    try {
        const rows = await reader.findCandidateResumeHtml(candidateId);
        if (rows.length === 0) {
            emitDiagnostic(onDiagnostic, {
                operation: "resume_prefetch",
                reason: "resume_unavailable",
            });
            return context;
        }
        const html = rows[0]?.HTMLResumeContent ?? rows[0]?.htmlResumeContent ?? rows[0]?.resumeHtmlContent;
        const plain = htmlResumeToPlainText(html);
        if (!plain) {
            emitDiagnostic(onDiagnostic, {
                operation: "resume_prefetch",
                reason: "resume_unavailable",
            });
            return context;
        }
        return {
            ...context,
            resumePlainText: plain,
        };
    } catch {
        emitDiagnostic(onDiagnostic, {
            operation: "resume_prefetch",
            reason: "query_failed",
        });
        return context;
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

function toCandidateLaunchContextRow({
    row,
    input,
    expectedCandidateId,
    expectedJobCollectionId,
    expectedRequirementId,
    jobDescriptionSource,
    talentChannelId,
    allowRequirementCatalogKey = false,
}: {
    row: Record<string, unknown>;
    input: CandidateLaunchContextLookupInput;
    expectedCandidateId: number;
    expectedJobCollectionId: number | null;
    expectedRequirementId: number | null;
    jobDescriptionSource: "JobCollection" | "RequirementMaster" | null;
    talentChannelId: number | null;
    allowRequirementCatalogKey?: boolean;
}): Exclude<CandidateLaunchContextRow, null> | null {
    const candidateId = readCanonicalInteger(row.candidateId);
    if (candidateId === null || candidateId !== expectedCandidateId) {
        return null;
    }

    let jobCollectionId: number | string | null = readCanonicalInteger(row.jobCollectionId);
    if (allowRequirementCatalogKey && typeof row.jobCollectionId === "string") {
        const catalogKey = row.jobCollectionId.trim();
        if (catalogKey.startsWith(REQUIREMENT_CATALOG_PREFIX)) {
            jobCollectionId = catalogKey;
        }
    }

    if (
        expectedJobCollectionId !== null
        && jobCollectionId !== expectedJobCollectionId
    ) {
        return null;
    }
    if (expectedJobCollectionId === null && typeof jobCollectionId === "number") {
        return null;
    }

    const requirementId = readCanonicalInteger(row.requirementId);
    if (
        (expectedRequirementId === null && requirementId !== null && !allowRequirementCatalogKey)
        || (expectedRequirementId !== null && requirementId !== expectedRequirementId)
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
        talentChannelId,
        jobCollectionId,
        requirementId,
        requirementCode: row.requirementCode ?? null,
        jobTitle: expectedJobCollectionId === null && expectedRequirementId === null ? null : row.jobTitle,
        jobDescription: expectedJobCollectionId === null && expectedRequirementId === null ? null : row.jobDescription,
        jobDescriptionSource: expectedJobCollectionId === null && expectedRequirementId === null
            ? null
            : jobDescriptionSource,
        client: expectedJobCollectionId === null && expectedRequirementId === null ? null : row.client,
        location: expectedJobCollectionId === null && expectedRequirementId === null ? null : row.location,
        isActive: expectedJobCollectionId === null && expectedRequirementId === null ? null : row.isActive,
        isExpired: expectedJobCollectionId === null && expectedRequirementId === null ? null : row.isExpired,
        expirationDate: expectedJobCollectionId === null && expectedRequirementId === null
            ? null
            : normalizeTimestamp(row.expirationDate),
        resumePlainText: null,
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

function parseNonNegativeSqlInt(value: string) {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
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
