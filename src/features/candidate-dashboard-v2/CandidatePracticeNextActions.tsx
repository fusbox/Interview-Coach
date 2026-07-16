"use client";

import { ArrowRight, Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { createCandidateFocusedPracticeHref } from "./candidate-coach-update-detail";
import {
    useCandidateNextRoundBuilder,
    type CandidateNextRoundChoicePointer,
} from "./CandidateNextRoundBuilderExperience";

export function CandidateQuestionPracticeActions({
    pointer,
    practiceNowHref,
    isCurrent = true,
}: {
    pointer: CandidateNextRoundChoicePointer;
    practiceNowHref?: string | null;
    isCurrent?: boolean;
}) {
    const controller = useCandidateNextRoundBuilder();
    const choiceState = controller?.resolveChoice(pointer) ?? null;
    const resolvedPracticeNowHref = practiceNowHref ?? (choiceState
        ? createCandidateFocusedPracticeHref({
            kind: choiceState.choice.practiceKind,
            candidatePracticeSessionId: choiceState.choice.sourceCandidatePracticeSessionId,
            questionKey: choiceState.choice.sourceQuestionKey,
        })
        : null);

    if (!resolvedPracticeNowHref && !choiceState) {
        return null;
    }

    return (
        <div className="candidate-practice-next-actions">
            {resolvedPracticeNowHref ? (
                <a
                    className="candidate-practice-next-actions__now"
                    href={resolvedPracticeNowHref}
                    tabIndex={isCurrent ? undefined : -1}
                >
                    Practice this now
                    <ArrowRight size={16} aria-hidden="true" />
                </a>
            ) : null}
            {choiceState && controller ? (
                <CandidateNextRoundQueueAction
                    choiceKey={choiceState.choiceKey}
                    isQueued={Boolean(choiceState.queuedItem)}
                    isCurrent={isCurrent}
                    onToggle={() => controller.toggleChoice(pointer)}
                    isBusy={controller.busyChoiceKey === choiceState.choiceKey}
                />
            ) : null}
        </div>
    );
}

function CandidateNextRoundQueueAction({
    choiceKey,
    isQueued,
    isCurrent,
    isBusy,
    onToggle,
}: {
    choiceKey: string;
    isQueued: boolean;
    isCurrent: boolean;
    isBusy: boolean;
    onToggle: () => Promise<{ ok: boolean; outcome?: string }>;
}) {
    const [notice, setNotice] = useState<{ kind: "info" | "error"; message: string } | null>(null);
    const label = isQueued ? "Added to next round" : "Add to next round";

    return (
        <div className="candidate-practice-next-actions__queue">
            <button
                type="button"
                role="switch"
                aria-checked={isQueued}
                aria-label={label}
                tabIndex={isCurrent ? undefined : -1}
                disabled={isBusy}
                data-choice-key={choiceKey}
                onClick={async () => {
                    setNotice(null);
                    const result = await onToggle();
                    if (result.outcome === "version_conflict") {
                        setNotice({
                            kind: "info",
                            message: "This round changed somewhere else. I loaded the latest version.",
                        });
                    } else if (!result.ok) {
                        setNotice({ kind: "error", message: "I couldn't update your next round. Try again." });
                    }
                }}
            >
                {isBusy
                    ? <Loader2 className="is-spinning" size={16} aria-hidden="true" />
                    : isQueued
                        ? <Check size={16} aria-hidden="true" />
                        : <Plus size={16} aria-hidden="true" />}
                <span>{isBusy ? "Updating..." : label}</span>
            </button>
            {notice ? (
                <p className={`is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
                    {notice.message}
                </p>
            ) : null}
        </div>
    );
}
