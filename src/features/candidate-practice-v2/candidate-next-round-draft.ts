import type {
    CandidateFollowUpPracticeIntentKind,
    CandidatePracticeIntentItem,
    CandidatePracticeIntentItemProvenance,
} from "./candidate-follow-up-practice-intent";

export const candidateNextRoundDraftItemLimit = 20;

export type CandidateNextRoundDraftItem = {
    candidateNextRoundDraftItemId: string;
    sourceCandidatePracticeSessionId: string;
    sourceQuestionKey: string;
    practiceKind: CandidateFollowUpPracticeIntentKind;
    provenance: CandidatePracticeIntentItemProvenance;
    displayPosition: number;
    createdAt: string;
    updatedAt: string;
};

export type CandidateNextRoundDraftRecord = {
    status: "candidate_next_round_draft";
    candidateNextRoundDraftId: string;
    candidateProfileId: string;
    roleProfileId: string;
    version: number;
    itemCount: number;
    items: CandidateNextRoundDraftItem[];
    createdAt: string;
    updatedAt: string;
};

export type CandidateNextRoundDraftMutationOutcome =
    | "updated"
    | "unchanged"
    | "version_conflict"
    | "invalid_source"
    | "item_conflict"
    | "capacity_exceeded"
    | "invalid_order"
    | "not_found";

export type CandidateNextRoundDraftMutationResult = {
    outcome: CandidateNextRoundDraftMutationOutcome;
    version?: number;
    candidateNextRoundDraftItemId?: string;
};

export function normalizeCandidateNextRoundDraftRecord(
    row: Record<string, unknown> | undefined,
): CandidateNextRoundDraftRecord | null {
    if (!row) {
        return null;
    }

    const candidateNextRoundDraftId = readString(row.candidate_next_round_draft_id);
    const candidateProfileId = readString(row.candidate_profile_id);
    const roleProfileId = readString(row.role_profile_id);
    const version = readPositiveInteger(row.version);
    const items = normalizeItems(row.items_json);
    const createdAt = readDateString(row.created_at);
    const updatedAt = readDateString(row.updated_at);

    if (
        !candidateNextRoundDraftId
        || !candidateProfileId
        || !roleProfileId
        || !version
        || !items
        || !createdAt
        || !updatedAt
    ) {
        return null;
    }

    return {
        status: "candidate_next_round_draft",
        candidateNextRoundDraftId,
        candidateProfileId,
        roleProfileId,
        version,
        itemCount: items.length,
        items,
        createdAt,
        updatedAt,
    };
}

export function createCandidateNextRoundDraftAssembly(
    item: CandidateNextRoundDraftItem,
): NonNullable<CandidatePracticeIntentItem["assembly"]> {
    return {
        source: "next_round_draft",
        candidateNextRoundDraftItemId: item.candidateNextRoundDraftItemId,
        provenance: item.provenance,
        displayPosition: item.displayPosition,
    };
}

export function validateCandidateNextRoundDraftOrder(
    orderedItemIds: string[],
    expectedItemCount?: number,
) {
    if (
        orderedItemIds.length < 1
        || orderedItemIds.length > candidateNextRoundDraftItemLimit
        || (expectedItemCount !== undefined && orderedItemIds.length !== expectedItemCount)
    ) {
        return null;
    }

    const normalized = orderedItemIds.map(readString);
    if (normalized.some((itemId) => !itemId)) {
        return null;
    }

    const itemIds = normalized as string[];
    return new Set(itemIds).size === itemIds.length ? itemIds : null;
}

export function isCandidatePracticeIntentItemProvenance(
    value: unknown,
): value is CandidatePracticeIntentItemProvenance {
    return value === "coach_update"
        || value === "coach_plan"
        || value === "practice_next"
        || value === "candidate_selection"
        || value === "coach_bundle";
}

function normalizeItems(value: unknown): CandidateNextRoundDraftItem[] | null {
    if (!Array.isArray(value) || value.length > candidateNextRoundDraftItemLimit) {
        return null;
    }

    const items = value.map(normalizeItem);
    if (items.some((item) => !item)) {
        return null;
    }

    const normalized = items as CandidateNextRoundDraftItem[];
    const sourceKeys = new Set<string>();
    const positions = new Set<number>();
    for (const item of normalized) {
        const sourceKey = `${item.sourceCandidatePracticeSessionId}:${item.sourceQuestionKey}`;
        if (sourceKeys.has(sourceKey) || positions.has(item.displayPosition)) {
            return null;
        }
        sourceKeys.add(sourceKey);
        positions.add(item.displayPosition);
    }

    return [...normalized].sort((left, right) => left.displayPosition - right.displayPosition);
}

function normalizeItem(value: unknown): CandidateNextRoundDraftItem | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const item = value as Record<string, unknown>;
    const candidateNextRoundDraftItemId = readString(item.candidateNextRoundDraftItemId);
    const sourceCandidatePracticeSessionId = readString(item.sourceCandidatePracticeSessionId);
    const sourceQuestionKey = readString(item.sourceQuestionKey);
    const practiceKind = item.practiceKind;
    const provenance = item.provenance;
    const displayPosition = readNonNegativeInteger(item.displayPosition);
    const createdAt = readDateString(item.createdAt);
    const updatedAt = readDateString(item.updatedAt);

    if (
        !candidateNextRoundDraftItemId
        || !sourceCandidatePracticeSessionId
        || !sourceQuestionKey
        || !isPracticeKind(practiceKind)
        || !isCandidatePracticeIntentItemProvenance(provenance)
        || displayPosition === null
        || displayPosition >= candidateNextRoundDraftItemLimit
        || !createdAt
        || !updatedAt
    ) {
        return null;
    }

    return {
        candidateNextRoundDraftItemId,
        sourceCandidatePracticeSessionId,
        sourceQuestionKey,
        practiceKind,
        provenance,
        displayPosition,
        createdAt,
        updatedAt,
    };
}

function isPracticeKind(value: unknown): value is CandidateFollowUpPracticeIntentKind {
    return value === "practice_from_feedback" || value === "practice_missing_evidence";
}

function readDateString(value: unknown) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return readString(value);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readNonNegativeInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
