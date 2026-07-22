import {
    createDefaultCandidateResumeDocumentRouteDependencies,
    handleCandidateResumeDocumentProcessRequest,
} from "./route-implementation";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const dependencies = createDefaultCandidateResumeDocumentRouteDependencies();
    if (!dependencies) {
        return Response.json({
            error: "Resume processing is temporarily unavailable.",
            code: "RESUME_PERSISTENCE_FAILED",
        }, { status: 503 });
    }
    return handleCandidateResumeDocumentProcessRequest(request, dependencies);
}
