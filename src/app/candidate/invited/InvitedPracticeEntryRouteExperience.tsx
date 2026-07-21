"use client";

import { useState } from "react";

import { CandidatePlannedSessionExperience } from "@/features/candidate-session-v2/CandidatePlannedSessionExperience";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { InvitedPracticeEntry } from "@/features/candidate-session-v2/InvitedPracticeEntry";
import { useSessionQuestionAudio } from "@/features/interview-session-v2/session-question-audio-browser";

export function InvitedPracticeEntryRouteExperience(props: {
    targetRole: string;
    stageLabel: string;
    questionCount: number;
    initialsConfirmed: boolean;
    candidateFirstName?: string;
    initialSession: CandidateProvisionalSessionRecord;
    questionAudioEnabled?: boolean;
}) {
    const [practiceStarted, setPracticeStarted] = useState(
        props.initialSession.progress?.status === "live_question"
        || props.initialSession.progress?.status === "question_preview",
    );
    const [startedFromLanding, setStartedFromLanding] = useState(false);
    const mutationBasePath = `/candidate/invited/session/${encodeURIComponent(props.initialSession.sessionId)}`;
    const { questionAudio } = useSessionQuestionAudio({
        enabled: Boolean(props.questionAudioEnabled),
        requestPath: `${mutationBasePath}/question-audio`,
    });

    if (practiceStarted) {
        return (
            <CandidatePlannedSessionExperience
                sessionId={props.initialSession.sessionId}
                dashboardHref="/candidate/invited"
                initialSession={props.initialSession}
                mutationBasePath={mutationBasePath}
                completionBehavior={{ kind: "invited_debrief" }}
                exitLabel="Pause session"
                invitedPauseEnabled
                entryTransitionRequested={startedFromLanding}
                entryTransitionStartsPractice={startedFromLanding}
                questionAudioEnabled={props.questionAudioEnabled}
            />
        );
    }

    return (
        <InvitedPracticeEntry
            {...props}
            sessionId={props.initialSession.sessionId}
            firstQuestion={props.initialSession.questionWordingSnapshot?.questions[0] ? {
                id: props.initialSession.questionWordingSnapshot.questions[0].slotId,
                number: 1,
                category: props.initialSession.questionWordingSnapshot.questions[0].category,
                questionText: props.initialSession.questionWordingSnapshot.questions[0].questionText,
            } : undefined}
            questionAudio={questionAudio}
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
