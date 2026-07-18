"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";

import {
    useCandidateNextRoundBuilder,
    type CandidateNextRoundChoicePointer,
} from "./CandidateNextRoundBuilderExperience";
import {
    CandidateFixedPracticeAction,
    type CandidateFixedPracticeIntentCreateInput,
    type CandidateFixedPracticeIntentCreateResult,
    type CandidateFixedPracticeIntentPointer,
} from "./CandidatePlanProgressAction";
import type { CandidateFollowUpPracticeIntentKind } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";

export function CandidateQuestionPracticeActions({
    pointer,
    practiceNowHref,
    isCurrent = true,
    createPracticeIntent,
    navigate,
}: {
    pointer: CandidateNextRoundChoicePointer;
    practiceNowHref?: string | null;
    isCurrent?: boolean;
    createPracticeIntent?: (
        input: CandidateFixedPracticeIntentCreateInput
    ) => Promise<CandidateFixedPracticeIntentCreateResult>;
    navigate?: (href: string) => void;
}) {
    const controller = useCandidateNextRoundBuilder();
    const choiceState = controller?.resolveChoice(pointer) ?? null;
    const immediatePointer = choiceState
        ? toFixedPracticeIntentPointer({
            practiceKind: choiceState.choice.practiceKind,
            candidatePracticeSessionId: choiceState.choice.sourceCandidatePracticeSessionId,
            questionKey: choiceState.choice.sourceQuestionKey,
        })
        : parseFixedPracticeIntentPointer(practiceNowHref);

    if (!immediatePointer && !choiceState) {
        return null;
    }

    return (
        <div className="candidate-practice-next-actions">
            {immediatePointer ? (
                <CandidateFixedPracticeAction
                    source="coach_update_detail"
                    items={[immediatePointer]}
                    label="Practice this now"
                    className="candidate-practice-next-actions__now"
                    tabIndex={isCurrent ? undefined : -1}
                    createPracticeIntent={createPracticeIntent}
                    navigate={navigate}
                />
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

function toFixedPracticeIntentPointer({
    practiceKind,
    candidatePracticeSessionId,
    questionKey,
}: {
    practiceKind: CandidateFollowUpPracticeIntentKind;
    candidatePracticeSessionId: string;
    questionKey: string;
}): CandidateFixedPracticeIntentPointer {
    return {
        intent: practiceKind === "practice_from_feedback"
            ? "coach-update-feedback-focus"
            : "coach-update-missing-evidence",
        fromSession: candidatePracticeSessionId,
        questionKey,
    };
}

function parseFixedPracticeIntentPointer(
    href: string | null | undefined,
): CandidateFixedPracticeIntentPointer | null {
    if (!href?.startsWith("/candidate/practice/ready?")) {
        return null;
    }
    const searchParams = new URL(href, "https://interviewcoach.invalid").searchParams;
    const intent = searchParams.get("intent");
    const fromSession = searchParams.get("fromSession");
    const questionKey = searchParams.get("questionKey");
    if (
        (intent !== "coach-update-feedback-focus" && intent !== "coach-update-missing-evidence")
        || !fromSession
        || !questionKey
    ) {
        return null;
    }
    return { intent, fromSession, questionKey };
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
