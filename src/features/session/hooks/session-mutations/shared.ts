import { Dispatch, MutableRefObject, SetStateAction } from "react";
import { InterviewSession } from "@/lib/domain/types";
import { NowState } from "@/lib/state/now.types";

export type ExclusiveCommandName = "start" | "submit" | "next" | "retry";

export type CommandState = {
    name: ExclusiveCommandName;
    sessionId: string;
};

export type SessionSetter = Dispatch<SetStateAction<InterviewSession | null | undefined>>;

export type MergeSessionFn = (updated: InterviewSession) => void;

export type CommandGate = {
    tryBeginCommand: (command: ExclusiveCommandName, sessionId: string) => boolean;
    finishCommand: (command: ExclusiveCommandName, sessionId: string) => void;
};

export type SessionMutationBase = {
    session: InterviewSession | null | undefined;
    setSession: SessionSetter;
    candidateToken?: string;
    mergeSession: MergeSessionFn;
};

export type SessionMutationWithNow = SessionMutationBase & {
    now: NowState;
};

export function buildSubmitIdempotencyKey(sessionId: string, questionId: string, answerText: string, modality: "text" | "voice" = "text"): string {
    let hash = 0;
    const input = `${sessionId}:${questionId}:${modality}:${answerText}`;
    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
    }

    return `submit:${sessionId}:${questionId}:${Math.abs(hash)}`;
}

export type InitPromiseRef = MutableRefObject<Promise<{ sessionId: string; candidateToken: string } | undefined> | null>;
