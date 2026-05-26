import { NextResponse } from "next/server";

import {
    finalizeCandidateOwnedSummary,
    resolveCandidateProfileFromIdentity,
    resolveLocalCandidateAuthHandoff,
} from "@/lib/server/candidate";

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
    const { sessionId } = await context.params;
    const handoff = await resolveLocalCandidateAuthHandoff();
    if (!handoff) {
        return NextResponse.json({ ok: false, error: "Candidate session is required." }, { status: 401 });
    }

    const profile = await resolveCandidateProfileFromIdentity(handoff);
    const result = await finalizeCandidateOwnedSummary({
        candidateProfileId: profile.candidateProfileId,
        sessionId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
