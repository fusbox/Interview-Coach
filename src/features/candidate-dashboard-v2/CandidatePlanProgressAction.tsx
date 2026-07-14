"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import type { CandidateDashboardPlanProgressIndicator } from "./candidate-dashboard-read-model";

type CandidatePlanProgressActionProps = {
    planProgress: CandidateDashboardPlanProgressIndicator;
    label: string;
    createPracticeIntent?: typeof createPlanAwarePracticeIntent;
    navigate?: (href: string) => void;
};

export function CandidatePlanProgressAction({
    planProgress,
    label,
    createPracticeIntent = createPlanAwarePracticeIntent,
    navigate = (href) => window.location.assign(href),
}: CandidatePlanProgressActionProps) {
    const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");

    if (planProgress.source !== "unanswered_planned_questions") {
        return (
            <a className="candidate-dashboard-action" href={planProgress.href}>
                {label}
                <ArrowRight size={16} aria-hidden="true" />
            </a>
        );
    }

    const canCreate = Boolean(
        planProgress.candidatePracticeSessionId
        && planProgress.questionKeys.length > 0,
    );

    return (
        <div className="candidate-dashboard-plan-action">
            <button
                className="candidate-dashboard-action"
                type="button"
                disabled={!canCreate || status === "creating"}
                onClick={async () => {
                    if (!planProgress.candidatePracticeSessionId || !canCreate) {
                        return;
                    }

                    setStatus("creating");
                    const redirectTo = await createPracticeIntent({
                        candidatePracticeSessionId: planProgress.candidatePracticeSessionId,
                        questionKeys: planProgress.questionKeys,
                    });
                    if (!redirectTo) {
                        setStatus("error");
                        return;
                    }

                    navigate(redirectTo);
                }}
            >
                {status === "creating" ? "Preparing practice..." : label}
                <ArrowRight size={16} aria-hidden="true" />
            </button>
            {status === "error" ? (
                <p role="alert">I could not prepare those questions. Try again.</p>
            ) : null}
        </div>
    );
}

async function createPlanAwarePracticeIntent({
    candidatePracticeSessionId,
    questionKeys,
}: {
    candidatePracticeSessionId: string;
    questionKeys: string[];
}) {
    try {
        const response = await fetch("/candidate/practice/ready/intents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                source: "plan_aware_queue",
                items: questionKeys.map((questionKey) => ({
                    intent: "coach-update-missing-evidence",
                    fromSession: candidatePracticeSessionId,
                    questionKey,
                })),
            }),
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
