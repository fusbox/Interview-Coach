import { randomUUID } from "node:crypto";

import {
    createDefaultCandidateSessionCompleteDependencies,
    type CandidateCompletedRoundRepairDiagnostic,
} from "@/app/candidate/session/[sessionId]/complete/route-implementation";
import type { CandidateCoachUpdateGenerationResult } from "@/features/candidate-dashboard-v2/candidate-coach-update-generation";
import {
    createCandidateCompletedRoundAnalysisRepairUnavailableResult,
    type CandidateCompletedRoundAnalysisRepairResult,
} from "@/features/candidate-session-v2/candidate-completed-round-analysis-repair";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateCompletedRoundRepairRouteDependencies = {
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    findCandidateSession?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
    }) => Promise<{ status?: string } | null>;
    repairCompletedRoundAnalysis?: (input: {
        request: Request;
        candidateProfileId: string;
        sourceCandidatePracticeSessionId: string;
    }) => Promise<CandidateCompletedRoundAnalysisRepairResult>;
    ensureCoachUpdateArtifact?: (input: {
        candidateProfileId: string;
        sourceCandidatePracticeSessionId: string;
        sourceQuestionKey?: string;
        settledAt?: string;
    }) => Promise<CandidateCoachUpdateGenerationResult>;
    recordCompletedRoundRepairDiagnostic?: (event: CandidateCompletedRoundRepairDiagnostic) => void | Promise<void>;
};

export async function POST(
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;
    const defaults = createDefaultCandidateSessionCompleteDependencies();
    return handleCandidateCompletedRoundRepairRequest({
        request,
        sessionId,
        resolveCandidateSessionIdentity: defaults.resolveCandidateSessionIdentity,
        findCandidateSession: defaults.practiceSessionRepository?.findSetupSession,
        repairCompletedRoundAnalysis: defaults.repairCompletedRoundAnalysis,
        ensureCoachUpdateArtifact: defaults.ensureCoachUpdateArtifact,
        recordCompletedRoundRepairDiagnostic: defaults.recordCompletedRoundRepairDiagnostic,
    });
}

export async function handleCandidateCompletedRoundRepairRequest({
    request,
    sessionId,
    resolveCandidateSessionIdentity,
    findCandidateSession,
    repairCompletedRoundAnalysis,
    ensureCoachUpdateArtifact,
    recordCompletedRoundRepairDiagnostic,
}: CandidateCompletedRoundRepairRouteDependencies & {
    request: Request;
    sessionId: string;
}) {
    const requestId = randomUUID();
    const responseHeaders = {
        "Cache-Control": "no-store",
        "X-Interview-Coach-Request-Id": requestId,
    };
    const identity = resolveCandidateSessionIdentity
        ? await resolveCandidateSessionIdentity(request)
        : null;
    if (!identity || !findCandidateSession) {
        return Response.json({ error: "Candidate session identity is required." }, {
            status: 401,
            headers: responseHeaders,
        });
    }

    const session = await findCandidateSession({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
    });
    if (!session) {
        return Response.json({ error: "Candidate practice session was not found." }, {
            status: 404,
            headers: responseHeaders,
        });
    }
    const sourceQuestionKey = new URL(request.url).searchParams.get("question")?.trim() || null;
    if (session.status !== "completed" && !sourceQuestionKey) {
        return Response.json({ error: "Coach Update repair requires a completed round." }, {
            status: 409,
            headers: responseHeaders,
        });
    }
    if (sourceQuestionKey) {
        if (!ensureCoachUpdateArtifact) {
            return Response.json({ error: "Coach Update repair is unavailable." }, {
                status: 503,
                headers: responseHeaders,
            });
        }
        const coachUpdate = await ensureCoachUpdateArtifact({
            candidateProfileId: identity.candidateProfileId,
            sourceCandidatePracticeSessionId: sessionId,
            sourceQuestionKey,
            settledAt: new Date().toISOString(),
        }).catch(() => ({
            status: "coach_update_unavailable" as const,
            reason: "generation_failed" as const,
        }));
        return Response.json({
            status: "candidate_question_coach_update_repair",
            coachUpdateStatus: coachUpdate.status,
        }, {
            status: coachUpdate.status === "coach_update_unavailable" ? 503 : 200,
            headers: responseHeaders,
        });
    }
    if (!repairCompletedRoundAnalysis) {
        return Response.json({ error: "Coach Update repair is unavailable." }, {
            status: 503,
            headers: responseHeaders,
        });
    }

    const coachingRepair = await repairCompletedRoundAnalysis({
        request,
        candidateProfileId: identity.candidateProfileId,
        sourceCandidatePracticeSessionId: sessionId,
    }).catch(() => createCandidateCompletedRoundAnalysisRepairUnavailableResult());
    // Session-level artifacts are read-only compatibility. New Coach Updates are
    // generated only for an exact settled-question checkpoint.

    if (recordCompletedRoundRepairDiagnostic) {
        try {
            await recordCompletedRoundRepairDiagnostic({
                event: "candidate_completed_round_coaching_repair",
                requestId,
                outcome: coachingRepair.status,
                attemptedCount: coachingRepair.attemptedCount,
                repairedCount: coachingRepair.repairedCount,
                pendingCount: coachingRepair.pendingCount,
                retryableCount: coachingRepair.retryableCount,
                unavailableCount: coachingRepair.unavailableCount,
                invalidLineageCount: coachingRepair.invalidLineageCount,
                coachUpdateStatus: "not_attempted",
            });
        } catch {
            // Diagnostic delivery cannot change the repair result.
        }
    }

    return Response.json({
        status: "candidate_completed_round_coaching_repair",
        coachingRepair,
        coachUpdateStatus: "not_attempted",
    }, { status: 200, headers: responseHeaders });
}
