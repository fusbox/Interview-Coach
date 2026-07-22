import {
    createDefaultCandidateResumeTextRouteDependencies,
    handleCandidateResumeTextProcessRequest,
} from "./route-implementation";

export async function POST(request: Request) {
    const dependencies = createDefaultCandidateResumeTextRouteDependencies();
    if (!dependencies) {
        return Response.json({
            error: "Resume processing is temporarily unavailable.",
            code: "RESUME_PERSISTENCE_FAILED",
        }, { status: 503 });
    }
    return handleCandidateResumeTextProcessRequest(request, dependencies);
}
