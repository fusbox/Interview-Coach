"use client";

import { useSessionQuestionAudio } from "@/features/interview-session-v2/session-question-audio-browser";

import {
    CandidatePreSessionLanding,
    type CandidatePreSessionQuestion,
} from "./CandidatePreSessionLanding";

export function CandidatePracticeIntentReadyLanding(props: {
    intentId: string;
    targetRole: string;
    stageLabel: string;
    questionCount: number;
    resumeIncluded: boolean;
    questions: CandidatePreSessionQuestion[];
    firstQuestion?: CandidatePreSessionQuestion;
    startActionUrl: string;
    returnHref: string;
    questionAudioEnabled: boolean;
}) {
    const requestPath = `/candidate/practice/ready/${encodeURIComponent(props.intentId)}/question-audio`;
    const { questionAudio } = useSessionQuestionAudio({
        enabled: props.questionAudioEnabled,
        requestPath,
    });

    return (
        <CandidatePreSessionLanding
            variant="follow_up"
            targetRole={props.targetRole}
            stageLabel={props.stageLabel}
            questionCount={props.questionCount}
            resumeIncluded={props.resumeIncluded}
            questions={props.questions}
            sessionId={props.intentId}
            firstQuestion={props.firstQuestion}
            questionAudio={questionAudio}
            startActionUrl={props.startActionUrl}
            returnHref={props.returnHref}
        />
    );
}
