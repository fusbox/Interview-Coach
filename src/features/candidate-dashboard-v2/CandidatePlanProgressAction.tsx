"use client";

import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import type { CandidatePracticeIntentSource } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";

import type { CandidateDashboardPlanProgressIndicator } from "./candidate-dashboard-read-model";

export type CandidateFixedPracticeIntentPointer = {
    intent: "coach-update-feedback-focus" | "coach-update-missing-evidence";
    fromSession: string;
    questionKey: string;
};

export type CandidateDirectPracticeIntentSource = Extract<
    CandidatePracticeIntentSource,
    "coach_update_detail" | "plan_aware_queue" | "coach_bundle"
>;

export type CandidateFixedPracticeIntentCreateInput = {
    source: CandidateDirectPracticeIntentSource;
    items: CandidateFixedPracticeIntentPointer[];
    idempotencyKey: string;
};

export const CANDIDATE_DIRECT_PRACTICE_INTENT_CONFLICT = "candidate_direct_practice_intent_conflict" as const;

export type CandidateFixedPracticeIntentCreateResult =
    | string
    | typeof CANDIDATE_DIRECT_PRACTICE_INTENT_CONFLICT
    | null;

type CandidatePlanProgressActionProps = {
    planProgress: CandidateDashboardPlanProgressIndicator;
    label: string;
    onCustomize?: () => void;
    createPracticeIntent?: (input: {
        candidatePracticeSessionId: string;
        questionKeys: string[];
        idempotencyKey: string;
    }) => Promise<string | null>;
    navigate?: (href: string) => void;
};

export function CandidatePlanProgressAction({
    planProgress,
    label,
    onCustomize,
    createPracticeIntent,
    navigate,
}: CandidatePlanProgressActionProps) {
    if (planProgress.source !== "unanswered_planned_questions") {
        if (!planProgress.href) {
            return null;
        }

        return (
            <a className="candidate-dashboard-action" href={planProgress.href}>
                {label}
                <ArrowRight size={16} aria-hidden="true" />
            </a>
        );
    }

    const candidatePracticeSessionId = planProgress.candidatePracticeSessionId;
    const items = candidatePracticeSessionId
        ? planProgress.questionKeys.map((questionKey) => ({
            intent: "coach-update-missing-evidence" as const,
            fromSession: candidatePracticeSessionId,
            questionKey,
        }))
        : [];

    return (
        <div className="candidate-dashboard-plan-action">
            <CandidateFixedPracticeAction
                source="plan_aware_queue"
                items={items}
                label={label}
                createPracticeIntent={createPracticeIntent && candidatePracticeSessionId
                    ? ({ idempotencyKey }) => createPracticeIntent({
                        candidatePracticeSessionId,
                        questionKeys: planProgress.questionKeys,
                        idempotencyKey,
                    })
                    : undefined}
                navigate={navigate}
            />
            {onCustomize ? (
                <button className="candidate-dashboard-reference-action" type="button" onClick={onCustomize}>
                    Customize round
                    <SlidersHorizontal size={16} aria-hidden="true" />
                </button>
            ) : null}
        </div>
    );
}

export function CandidateFixedPracticeAction({
    source,
    items,
    label,
    createPracticeIntent = createCandidateFixedPracticeIntent,
    navigate = (href) => window.location.assign(href),
    className = "candidate-dashboard-action",
    ariaLabel,
    tabIndex,
}: {
    source: CandidateDirectPracticeIntentSource;
    items: CandidateFixedPracticeIntentPointer[];
    label: string;
    createPracticeIntent?: (input: CandidateFixedPracticeIntentCreateInput) => Promise<CandidateFixedPracticeIntentCreateResult>;
    navigate?: (href: string) => void;
    className?: string;
    ariaLabel?: string;
    tabIndex?: number;
}) {
    const [status, setStatus] = useState<"idle" | "creating" | "error" | "changed">("idle");
    const isCreatingRef = useRef(false);
    const idempotencyKeyRef = useRef<string | null>(null);
    const canCreate = items.length > 0;

    return (
        <div className="candidate-dashboard-fixed-practice-action">
            <button
                className={className}
                type="button"
                aria-label={ariaLabel}
                tabIndex={tabIndex}
                disabled={!canCreate || status === "creating"}
                onClick={async () => {
                    if (!canCreate || isCreatingRef.current) return;
                    isCreatingRef.current = true;
                    setStatus("creating");
                    try {
                        idempotencyKeyRef.current ??= readOrCreateCandidateDirectPracticeIntentIdempotencyKey({
                            source,
                            items,
                        });
                        const redirectTo = await createPracticeIntent({
                            source,
                            items,
                            idempotencyKey: idempotencyKeyRef.current,
                        });
                        if (redirectTo === CANDIDATE_DIRECT_PRACTICE_INTENT_CONFLICT) {
                            clearCandidateDirectPracticeIntentIdempotencyKey(idempotencyKeyRef.current);
                            idempotencyKeyRef.current = null;
                            isCreatingRef.current = false;
                            setStatus("changed");
                            return;
                        }
                        if (!redirectTo) {
                            isCreatingRef.current = false;
                            setStatus("error");
                            return;
                        }
                        navigate(redirectTo);
                        clearCandidateDirectPracticeIntentIdempotencyKey(idempotencyKeyRef.current);
                        idempotencyKeyRef.current = null;
                    } catch {
                        isCreatingRef.current = false;
                        setStatus("error");
                    }
                }}
            >
                {status === "creating" ? "Preparing practice..." : label}
                <ArrowRight size={16} aria-hidden="true" />
            </button>
            {status === "error" ? <p role="alert">I could not prepare those questions. Try again.</p> : null}
            {status === "changed" ? <p role="alert">That practice choice changed. Review it and try again.</p> : null}
        </div>
    );
}

export async function createCandidateFixedPracticeIntent({
    source,
    items,
    idempotencyKey,
}: CandidateFixedPracticeIntentCreateInput) {
    try {
        const response = await fetch("/candidate/practice/ready/intents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({ source, items }),
        });
        const result = await response.json().catch(() => null) as {
            redirectTo?: unknown;
            reason?: unknown;
        } | null;
        if (response.status === 409 && result?.reason === "idempotency_conflict") {
            return CANDIDATE_DIRECT_PRACTICE_INTENT_CONFLICT;
        }
        return response.ok
            && typeof result?.redirectTo === "string"
            && result.redirectTo.startsWith("/candidate/practice/ready/")
            ? result.redirectTo
            : null;
    } catch {
        return null;
    }
}

function createCandidateDirectPracticeIntentIdempotencyKey() {
    return globalThis.crypto?.randomUUID?.()
        ?? `candidate-action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const CANDIDATE_DIRECT_PRACTICE_INTENT_PENDING_STORAGE_KEY = "candidate-v2:pending-direct-practice-intent";
const CANDIDATE_DIRECT_PRACTICE_INTENT_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function readOrCreateCandidateDirectPracticeIntentIdempotencyKey({
    source,
    items,
}: Pick<CandidateFixedPracticeIntentCreateInput, "source" | "items">) {
    const actionSignature = JSON.stringify({ source, items });
    try {
        const stored = window.sessionStorage.getItem(CANDIDATE_DIRECT_PRACTICE_INTENT_PENDING_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) as Record<string, unknown> : null;
        const storedAt = typeof parsed?.storedAt === "number" ? parsed.storedAt : Number.NaN;
        if (
            parsed?.actionSignature === actionSignature
            && typeof parsed.idempotencyKey === "string"
            && isCandidateDirectPracticeIntentIdempotencyKey(parsed.idempotencyKey)
            && Number.isFinite(storedAt)
            && storedAt <= Date.now()
            && Date.now() - storedAt < CANDIDATE_DIRECT_PRACTICE_INTENT_PENDING_MAX_AGE_MS
        ) {
            return parsed.idempotencyKey;
        }
    } catch {
        // A denied or malformed browser store must not block the action.
    }

    const idempotencyKey = createCandidateDirectPracticeIntentIdempotencyKey();
    try {
        window.sessionStorage.setItem(CANDIDATE_DIRECT_PRACTICE_INTENT_PENDING_STORAGE_KEY, JSON.stringify({
            actionSignature,
            idempotencyKey,
            storedAt: Date.now(),
        }));
    } catch {
        // The database boundary remains authoritative when browser storage is unavailable.
    }
    return idempotencyKey;
}

function clearCandidateDirectPracticeIntentIdempotencyKey(idempotencyKey: string) {
    try {
        const stored = window.sessionStorage.getItem(CANDIDATE_DIRECT_PRACTICE_INTENT_PENDING_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) as Record<string, unknown> : null;
        if (parsed?.idempotencyKey === idempotencyKey) {
            window.sessionStorage.removeItem(CANDIDATE_DIRECT_PRACTICE_INTENT_PENDING_STORAGE_KEY);
        }
    } catch {
        // A denied or malformed browser store must not block accepted navigation.
    }
}

function isCandidateDirectPracticeIntentIdempotencyKey(value: string) {
    return value.length >= 16
        && value.length <= 128
        && /^[A-Za-z0-9._:-]+$/.test(value);
}
