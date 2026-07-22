import {
    createDefaultCandidateResumeTextRouteDependencies,
    handleCandidateResumeTextAcceptRequest,
} from "../../route-implementation";

export async function POST(
    request: Request,
    context: { params: Promise<{ artifactId: string }> },
) {
    const dependencies = createDefaultCandidateResumeTextRouteDependencies();
    if (!dependencies) {
        return Response.json({
            error: "Resume processing is temporarily unavailable.",
            code: "RESUME_PERSISTENCE_FAILED",
        }, { status: 503 });
    }
    const { artifactId } = await context.params;
    return handleCandidateResumeTextAcceptRequest(request, artifactId, dependencies);
}
