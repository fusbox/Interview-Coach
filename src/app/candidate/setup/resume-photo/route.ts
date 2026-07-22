import {
    createDefaultCandidateResumePhotoRouteDependencies,
    handleCandidateResumePhotoProcessRequest,
} from "./route-implementation";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const dependencies = createDefaultCandidateResumePhotoRouteDependencies();
    if (!dependencies) {
        return Response.json({
            error: "Photo reading is temporarily unavailable. Upload a document or paste the resume text.",
            code: "OCR_NOT_CONFIGURED",
        }, { status: 503 });
    }
    return handleCandidateResumePhotoProcessRequest(request, dependencies);
}
