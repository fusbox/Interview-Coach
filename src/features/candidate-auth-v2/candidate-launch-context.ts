export type CandidateLaunchJobDescriptionSource =
    | "JobCollection"
    | "RequirementMaster"
    | "RequirementDescTxn"
    | "HostPayload";

export type CandidateLaunchResumeSourceType =
    | "ResumeParserJSONMaster"
    | "CandidateResume"
    | "DisplayCandidateResume"
    | "SubmissionResume"
    | "None";

export type CandidateLaunchContext = {
    candidate: {
        candidateId: string;
        userId: string | null;
        companyId: string | null;
        email: string | null;
        displayName: string | null;
    };
    source: {
        hostDomain: string | null;
        sourceSurface: string;
        talentChannelId: string | null;
    };
    job: {
        jobCollectionId: string;
        requirementId: string | null;
        requirementCode: string | null;
        title: string;
        description: string;
        descriptionSource: CandidateLaunchJobDescriptionSource;
        client: string | null;
        location: string | null;
        isActive: boolean | null;
        isExpired: boolean | null;
        expirationDate: string | null;
    };
    resume: {
        hasParsedResume: boolean;
        sourceType: CandidateLaunchResumeSourceType;
        createdDate: string | null;
        contentAvailable: boolean;
    };
    consent: {
        hasAIConsent: boolean;
        consentDate: string | null;
    };
};

export type CandidateLaunchContextRow = {
    candidateId: unknown;
    userId?: unknown;
    companyId?: unknown;
    email?: unknown;
    displayName?: unknown;
    hostDomain?: unknown;
    sourceSurface?: unknown;
    talentChannelId?: unknown;
    jobCollectionId: unknown;
    requirementId?: unknown;
    requirementCode?: unknown;
    jobTitle: unknown;
    jobDescription: unknown;
    jobDescriptionSource?: unknown;
    client?: unknown;
    location?: unknown;
    isActive?: unknown;
    isExpired?: unknown;
    expirationDate?: unknown;
    hasParsedResume?: unknown;
    resumeSourceType?: unknown;
    resumeCreatedDate?: unknown;
    resumeContentAvailable?: unknown;
    hasAIConsent?: unknown;
    aiConsentDate?: unknown;
} | null;

export type CandidateLaunchContextLookupInput = {
    candidateId: string;
    jobCollectionId: string;
    hostDomain: string | null;
    sourceSurface: string;
};

export type CandidateLaunchContextFailureReason =
    | "missing_launch_context"
    | "missing_candidate_id"
    | "missing_job_collection_id"
    | "missing_job_title"
    | "missing_job_description"
    | "invalid_job_description_source"
    | "invalid_resume_source";

export type CandidateLaunchContextResult =
    | {
        ok: true;
        context: CandidateLaunchContext;
    }
    | {
        ok: false;
        reason: CandidateLaunchContextFailureReason;
    };

export type CandidateLaunchContextResolverDependencies = {
    input: CandidateLaunchContextLookupInput;
    lookupLaunchContext: (input: CandidateLaunchContextLookupInput) => Promise<CandidateLaunchContextRow>;
};

const jobDescriptionSources = new Set<CandidateLaunchJobDescriptionSource>([
    "JobCollection",
    "RequirementMaster",
    "RequirementDescTxn",
    "HostPayload",
]);

const resumeSourceTypes = new Set<CandidateLaunchResumeSourceType>([
    "ResumeParserJSONMaster",
    "CandidateResume",
    "DisplayCandidateResume",
    "SubmissionResume",
    "None",
]);

export async function resolveCandidateLaunchContext({
    input,
    lookupLaunchContext,
}: CandidateLaunchContextResolverDependencies): Promise<CandidateLaunchContextResult> {
    return normalizeCandidateLaunchContextRow(await lookupLaunchContext(input));
}

export function normalizeCandidateLaunchContextRow(row: CandidateLaunchContextRow): CandidateLaunchContextResult {
    if (!row) {
        return fail("missing_launch_context");
    }

    const candidateId = toNullableString(row.candidateId);
    if (!candidateId) {
        return fail("missing_candidate_id");
    }

    const jobCollectionId = toNullableString(row.jobCollectionId);
    if (!jobCollectionId) {
        return fail("missing_job_collection_id");
    }

    const title = toNullableString(row.jobTitle);
    if (!title) {
        return fail("missing_job_title");
    }

    const description = toNullableString(row.jobDescription);
    if (!description) {
        return fail("missing_job_description");
    }

    const descriptionSource = toJobDescriptionSource(row.jobDescriptionSource);
    if (!descriptionSource) {
        return fail("invalid_job_description_source");
    }

    const resumeSource = toResumeSourceType(row.resumeSourceType, Boolean(row.hasParsedResume));
    if (!resumeSource) {
        return fail("invalid_resume_source");
    }

    return {
        ok: true,
        context: {
            candidate: {
                candidateId,
                userId: toNullableString(row.userId),
                companyId: toNullableString(row.companyId),
                email: toNullableString(row.email),
                displayName: toNullableString(row.displayName),
            },
            source: {
                hostDomain: toNullableString(row.hostDomain),
                sourceSurface: toNullableString(row.sourceSurface) ?? "UNKNOWN",
                talentChannelId: toNullableString(row.talentChannelId),
            },
            job: {
                jobCollectionId,
                requirementId: toNullableString(row.requirementId),
                requirementCode: toNullableString(row.requirementCode),
                title,
                description,
                descriptionSource,
                client: toNullableString(row.client),
                location: toNullableString(row.location),
                isActive: toNullableBoolean(row.isActive),
                isExpired: toNullableBoolean(row.isExpired),
                expirationDate: toNullableString(row.expirationDate),
            },
            resume: {
                hasParsedResume: Boolean(row.hasParsedResume),
                sourceType: resumeSource,
                createdDate: toNullableString(row.resumeCreatedDate),
                contentAvailable: Boolean(row.resumeContentAvailable),
            },
            consent: {
                hasAIConsent: Boolean(row.hasAIConsent),
                consentDate: toNullableString(row.aiConsentDate),
            },
        },
    };
}

function toJobDescriptionSource(value: unknown): CandidateLaunchJobDescriptionSource | null {
    const source = toNullableString(value) ?? "JobCollection";
    return jobDescriptionSources.has(source as CandidateLaunchJobDescriptionSource)
        ? source as CandidateLaunchJobDescriptionSource
        : null;
}

function toResumeSourceType(value: unknown, hasParsedResume: boolean): CandidateLaunchResumeSourceType | null {
    const source = toNullableString(value) ?? (hasParsedResume ? null : "None");
    return source && resumeSourceTypes.has(source as CandidateLaunchResumeSourceType)
        ? source as CandidateLaunchResumeSourceType
        : null;
}

function toNullableString(value: unknown) {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}

function toNullableBoolean(value: unknown) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value === 1 ? true : value === 0 ? false : null;
    }

    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) {
        return true;
    }
    if (["false", "0", "no"].includes(normalized)) {
        return false;
    }

    return null;
}

function fail(reason: CandidateLaunchContextFailureReason): CandidateLaunchContextResult {
    return {
        ok: false,
        reason,
    };
}
