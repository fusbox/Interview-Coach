"use client";

import { useState } from "react";

import { CandidatePlannedSessionExperience } from "@/features/candidate-session-v2/CandidatePlannedSessionExperience";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { InvitedPracticeEntry } from "@/features/candidate-session-v2/InvitedPracticeEntry";

export function InvitedPracticeEntryRouteExperience(props: {
    targetRole: string;
    stageLabel: string;
    questionCount: number;
    initialsConfirmed: boolean;
    candidateFirstName?: string;
    initialSession: CandidateProvisionalSessionRecord;
}) {
    const [practiceStarted, setPracticeStarted] = useState(
        props.initialSession.progress?.status === "live_question"
        || props.initialSession.progress?.status === "question_preview",
    );
    const [startedFromLanding, setStartedFromLanding] = useState(false);

    if (practiceStarted) {
        const mutationBasePath = `/candidate/invited/session/${encodeURIComponent(props.initialSession.sessionId)}`;
        return (
            <CandidatePlannedSessionExperience
                sessionId={props.initialSession.sessionId}
                dashboardHref="/candidate/invited"
                initialSession={props.initialSession}
                mutationBasePath={mutationBasePath}
                completionBehavior={{ kind: "invited_debrief" }}
                exitHref="/candidate/invited"
                exitLabel="Return to invitation"
                entryTransitionRequested={startedFromLanding}
                entryTransitionStartsPractice={startedFromLanding}
            />
        );
    }

    return (
        <InvitedPracticeEntry
            {...props}
            onConfirmInitials={async (initials) => {
                const response = await fetch("/candidate/invited/initials", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ initials }),
                });
                if (response.status === 401) {
                    window.location.assign("/candidate/invited/unavailable");
                    throw new Error("Invited access expired.");
                }
                if (!response.ok) throw new Error("Initials could not be saved.");
                return await response.json() as { candidateFirstName?: string };
            }}
            onStart={() => {
                setStartedFromLanding(true);
                setPracticeStarted(true);
            }}
        />
    );
}
