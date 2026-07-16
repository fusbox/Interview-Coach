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

type CandidatePlanProgressActionProps = {
    planProgress: CandidateDashboardPlanProgressIndicator;
    label: string;
    onCustomize?: () => void;
    createPracticeIntent?: (input: {
        candidatePracticeSessionId: string;
        questionKeys: string[];
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
                    ? () => createPracticeIntent({
                        candidatePracticeSessionId,
                        questionKeys: planProgress.questionKeys,
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
}: {
    source: Extract<CandidatePracticeIntentSource, "plan_aware_queue" | "coach_bundle">;
    items: CandidateFixedPracticeIntentPointer[];
    label: string;
    createPracticeIntent?: (input: {
        source: Extract<CandidatePracticeIntentSource, "plan_aware_queue" | "coach_bundle">;
        items: CandidateFixedPracticeIntentPointer[];
    }) => Promise<string | null>;
    navigate?: (href: string) => void;
}) {
    const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
    const isCreatingRef = useRef(false);
    const canCreate = items.length > 0;

    return (
        <div className="candidate-dashboard-fixed-practice-action">
            <button
                className="candidate-dashboard-action"
                type="button"
                disabled={!canCreate || status === "creating"}
                onClick={async () => {
                    if (!canCreate || isCreatingRef.current) return;
                    isCreatingRef.current = true;
                    setStatus("creating");
                    try {
                        const redirectTo = await createPracticeIntent({ source, items });
                        if (!redirectTo) {
                            isCreatingRef.current = false;
                            setStatus("error");
                            return;
                        }
                        navigate(redirectTo);
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
        </div>
    );
}

export async function createCandidateFixedPracticeIntent({
    source,
    items,
}: {
    source: Extract<CandidatePracticeIntentSource, "plan_aware_queue" | "coach_bundle">;
    items: CandidateFixedPracticeIntentPointer[];
}) {
    try {
        const response = await fetch("/candidate/practice/ready/intents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, items }),
        });
        const result = await response.json().catch(() => null) as { redirectTo?: unknown } | null;
        return response.ok
            && typeof result?.redirectTo === "string"
            && result.redirectTo.startsWith("/candidate/practice/ready/")
            ? result.redirectTo
            : null;
    } catch {
        return null;
    }
}
