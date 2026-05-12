"use server";

import { redirect } from "next/navigation";

import {
    advanceCandidateOwnedSession,
    resolveCandidateProfileFromIdentity,
    resolveLocalCandidateAuthHandoff,
    startCandidateOwnedSession,
} from "@/lib/server/candidate";
import type { SessionStatus } from "@/lib/domain/types";

type CandidateSessionActionResult = {
    ok: false;
    error: string;
};

export async function startCandidateSessionAction(sessionId: string): Promise<CandidateSessionActionResult> {
    const profile = await resolveCurrentCandidateProfile();
    if (!profile.ok) {
        return profile;
    }

    const result = await startCandidateOwnedSession({
        candidateProfileId: profile.candidateProfileId,
        sessionId,
    });

    if (!result.ok) {
        return result;
    }

    redirect(`/session/${result.sessionId}`);
}

export async function advanceCandidateSessionAction(
    sessionId: string,
    currentQuestionIndex: number,
    status: Extract<SessionStatus, "IN_SESSION" | "COMPLETED">,
): Promise<CandidateSessionActionResult> {
    const profile = await resolveCurrentCandidateProfile();
    if (!profile.ok) {
        return profile;
    }

    const result = await advanceCandidateOwnedSession({
        candidateProfileId: profile.candidateProfileId,
        sessionId,
        currentQuestionIndex,
        status,
    });

    if (!result.ok) {
        return result;
    }

    redirect(`/session/${result.sessionId}`);
}

async function resolveCurrentCandidateProfile(): Promise<
    | { ok: true; candidateProfileId: string }
    | CandidateSessionActionResult
> {
    const handoff = await resolveLocalCandidateAuthHandoff();
    if (!handoff) {
        return { ok: false, error: "Candidate session is required." };
    }

    const profile = await resolveCandidateProfileFromIdentity(handoff);
    return { ok: true, candidateProfileId: profile.candidateProfileId };
}
