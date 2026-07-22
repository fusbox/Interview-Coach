import {
    createDefaultCandidateResumeTextRouteDependencies,
    handleCandidateResumeSelectionClearRequest,
} from "../route-implementation";

export async function DELETE(request: Request) {
    const dependencies = createDefaultCandidateResumeTextRouteDependencies();
    if (!dependencies) {
        return Response.json({
            error: "Resume processing is temporarily unavailable.",
            code: "RESUME_PERSISTENCE_FAILED",
        }, { status: 503 });
    }
    return handleCandidateResumeSelectionClearRequest(request, dependencies);
}
