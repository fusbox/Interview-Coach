import { hashInvitedPracticeToken } from "./invited-practice-token-vault";
import {
    createInvitedPracticeBrowserSessionMaterial,
    hashInvitedPracticeBrowserSessionToken,
    isInvitedPracticeBearer,
    type InvitedPracticeBrowserSessionMaterial,
} from "./invited-practice-access-session";
import type {
    InvitedPracticeAccessContext,
    InvitedPracticeAccessRepository,
} from "./invited-practice-access-repository";

const UNICODE_LETTER_PATTERN = new RegExp("\\p{L}", "u");

export type InvitedPracticeEntryProjection = {
    targetRole: string;
    interviewStage: InvitedPracticeAccessContext["interviewStage"];
    questionCount: number;
    sessionStatus: InvitedPracticeAccessContext["status"];
    initialsConfirmed: boolean;
    candidateFirstName?: string;
};

export async function exchangeInvitedPracticeLink(input: {
    rawInvitationToken: string | null | undefined;
    now: Date;
    accessTtlSeconds: number;
}, dependencies: {
    repository: InvitedPracticeAccessRepository;
    createBrowserSessionMaterial?: () => InvitedPracticeBrowserSessionMaterial;
}) {
    if (!isInvitedPracticeBearer(input.rawInvitationToken)) return null;
    const material = dependencies.createBrowserSessionMaterial?.()
        ?? createInvitedPracticeBrowserSessionMaterial();
    const requestedExpiresAt = new Date(input.now.getTime() + input.accessTtlSeconds * 1_000).toISOString();
    const context = await dependencies.repository.exchangeInvitationToken({
        invitationTokenHash: hashInvitedPracticeToken(input.rawInvitationToken),
        browserSessionId: material.browserSessionId,
        browserSessionTokenHash: material.sessionTokenHash,
        requestedExpiresAt,
    });
    if (!context) return null;

    return {
        rawBrowserSessionToken: material.rawSessionToken,
        expiresAt: context.browserSessionExpiresAt,
        entry: createInvitedPracticeEntryProjection(context),
    };
}

export async function resolveInvitedPracticeEntry(
    rawBrowserSessionToken: string | null | undefined,
    repository: InvitedPracticeAccessRepository,
) {
    const context = await resolveInvitedPracticeAccessContext(rawBrowserSessionToken, repository);
    return context ? createInvitedPracticeEntryProjection(context) : null;
}

export async function resolveInvitedPracticeAccessContext(
    rawBrowserSessionToken: string | null | undefined,
    repository: InvitedPracticeAccessRepository,
) {
    if (!isInvitedPracticeBearer(rawBrowserSessionToken)) return null;
    return repository.resolveBrowserSession(
        hashInvitedPracticeBrowserSessionToken(rawBrowserSessionToken),
    );
}

export async function confirmInvitedPracticeInitials(input: {
    rawBrowserSessionToken: string | null | undefined;
    initials: unknown;
}, repository: InvitedPracticeAccessRepository) {
    if (!isInvitedPracticeBearer(input.rawBrowserSessionToken)) return null;
    const enteredInitials = normalizeInvitedPracticeInitials(input.initials);
    if (!enteredInitials) {
        throw new InvalidInvitedPracticeInitialsError();
    }
    const result = await repository.confirmInitials({
        sessionTokenHash: hashInvitedPracticeBrowserSessionToken(input.rawBrowserSessionToken),
        enteredInitials,
    });
    if (!result) return null;

    return {
        initialsConfirmed: true as const,
        matchState: result.signal.matchState,
        ...(result.signal.matchState === "match" ? { candidateFirstName: result.firstName } : {}),
    };
}

export class InvalidInvitedPracticeInitialsError extends Error {
    constructor() {
        super("Enter one or two letters.");
        this.name = "InvalidInvitedPracticeInitialsError";
    }
}

export function normalizeInvitedPracticeInitials(value: unknown) {
    if (typeof value !== "string") return "";
    return Array.from(value.normalize("NFKC").toLocaleUpperCase("en-US"))
        .filter(isLetter)
        .slice(0, 2)
        .join("");
}

function isLetter(character: string) {
    return UNICODE_LETTER_PATTERN.test(character);
}

export function createInvitedPracticeEntryProjection(
    context: InvitedPracticeAccessContext,
): InvitedPracticeEntryProjection {
    const questionCount = Number(context.questionPlanSnapshot.questionCount);
    if (!Number.isInteger(questionCount) || questionCount < 1) {
        throw new Error("Invited practice question plan is invalid.");
    }
    return {
        targetRole: context.targetRole,
        interviewStage: context.interviewStage,
        questionCount,
        sessionStatus: context.status,
        initialsConfirmed: Boolean(context.entrySignal),
        ...(context.entrySignal?.matchState === "match" ? { candidateFirstName: context.firstName } : {}),
    };
}
