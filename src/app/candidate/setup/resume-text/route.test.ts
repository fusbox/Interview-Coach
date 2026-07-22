import { describe, expect, it, vi } from "vitest";

import {
    CandidateResumeArtifactRepositoryError,
    type CandidateResumeTextArtifact,
} from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
import {
    handleCandidateResumeTextAcceptRequest,
    handleCandidateResumeTextProcessRequest,
    handleCandidateResumeSelectionClearRequest,
    type CandidateResumeTextRouteDependencies,
} from "./route-implementation";

const origin = "https://interviewcoach.talentarbor.com";
const candidateProfileId = "10000000-0000-4000-8000-000000000001";
const artifactId = "20000000-0000-4000-8000-000000000001";
const setupOwnerKey = `candidate:${candidateProfileId}`;
const operationId = "30000000-0000-4000-8000-000000000001";

describe("candidate resume text routes", () => {
    it("proves same-origin candidate identity before processing pasted source content", async () => {
        const createOrRecoverReviewArtifact = vi.fn(async () => artifact());
        const response = await handleCandidateResumeTextProcessRequest(request("/candidate/setup/resume-text", {
            source: "pasted_text",
            text: "Inventory lead with shipping experience.",
        }), dependencies({ createOrRecoverReviewArtifact }));

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            artifact: {
                artifactId,
                reviewState: "awaiting_review",
                normalizedText: "Inventory lead with shipping experience.",
            },
        });
        expect(createOrRecoverReviewArtifact).toHaveBeenCalledWith({
            candidateProfileId,
            source: "pasted_text",
            text: "Inventory lead with shipping experience.",
            candidateLabel: "Pasted resume",
            now: new Date("2026-07-21T12:00:00.000Z"),
        });
    });

    it("rejects cross-origin and unauthorized requests before reading source content", async () => {
        const createOrRecoverReviewArtifact = vi.fn();
        const crossOriginResponse = await handleCandidateResumeTextProcessRequest(new Request(`${origin}/candidate/setup/resume-text`, {
            method: "POST",
            headers: {
                Origin: "https://malicious.example",
                "Content-Type": "application/json",
            },
            body: "not-json",
        }), dependencies({ createOrRecoverReviewArtifact }));
        expect(crossOriginResponse.status).toBe(403);

        const resolveIdentity = vi.fn(async () => null);
        const unauthorizedResponse = await handleCandidateResumeTextProcessRequest(new Request(`${origin}/candidate/setup/resume-text`, {
            method: "POST",
            headers: {
                Origin: origin,
                "Content-Type": "application/json",
            },
            body: "not-json",
        }), dependencies({ createOrRecoverReviewArtifact, resolveIdentity }));
        expect(unauthorizedResponse.status).toBe(401);
        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("does not expose the server-only trusted-host source through the browser route", async () => {
        const createOrRecoverReviewArtifact = vi.fn();
        const response = await handleCandidateResumeTextProcessRequest(request("/candidate/setup/resume-text", {
            source: "trusted_host",
            text: "Inventory lead with shipping experience.",
        }), dependencies({ createOrRecoverReviewArtifact }));

        expect(response.status).toBe(400);
        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("rejects missing operation identity and late superseded results", async () => {
        const missingOperation = new Request(`${origin}/candidate/setup/resume-text`, {
            method: "POST",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body: JSON.stringify({ source: "pasted_text", text: "Inventory lead." }),
        });
        const missingResponse = await handleCandidateResumeTextProcessRequest(missingOperation, dependencies());
        expect(missingResponse.status).toBe(400);

        const response = await handleCandidateResumeTextProcessRequest(
            request("/candidate/setup/resume-text", {
                source: "pasted_text",
                text: "Inventory lead.",
            }),
            dependencies({ finalizeSelectionOperation: vi.fn(async () => false) }),
        );
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ code: "RESUME_SELECTION_STALE" });
    });

    it("bounds the actual request stream when content-length is absent", async () => {
        const createOrRecoverReviewArtifact = vi.fn();
        const oversizedRequest = request("/candidate/setup/resume-text", {
            source: "pasted_text",
            text: "x".repeat(130_000),
        });
        expect(oversizedRequest.headers.get("content-length")).toBeNull();

        const response = await handleCandidateResumeTextProcessRequest(
            oversizedRequest,
            dependencies({ createOrRecoverReviewArtifact }),
        );

        expect(response.status).toBe(413);
        await expect(response.json()).resolves.toEqual({
            error: "Resume text is too large.",
            code: "RESUME_TOO_LARGE",
        });
        expect(createOrRecoverReviewArtifact).not.toHaveBeenCalled();
    });

    it("accepts revision-fenced review text and returns policy-triggered re-review", async () => {
        const acceptReview = vi.fn(async () => ({
            outcome: "review_required" as const,
            artifact: artifact({ revision: 2 }),
        }));
        const response = await handleCandidateResumeTextAcceptRequest(
            request(`/candidate/setup/resume-text/${artifactId}/accept`, {
                version: 1,
                revision: 1,
                reviewedText: "Inventory lead with shipping experience. dev@example.com",
            }),
            artifactId,
            dependencies({ acceptReview }),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            outcome: "review_required",
            artifact: { artifactId, revision: 2 },
        });
        expect(acceptReview).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId,
            setupOwnerKey,
            artifactId,
            expectedVersion: 1,
            expectedRevision: 1,
        }));
    });

    it("maps stale review races to a candidate-safe conflict", async () => {
        const response = await handleCandidateResumeTextAcceptRequest(
            request(`/candidate/setup/resume-text/${artifactId}/accept`, {
                version: 1,
                revision: 1,
                reviewedText: "Inventory lead with shipping experience.",
            }),
            artifactId,
            dependencies({
                acceptReview: vi.fn(async () => {
                    throw new CandidateResumeArtifactRepositoryError("STALE_REVISION");
                }),
            }),
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "This resume review changed in another tab. Review the latest version and try again.",
            code: "RESUME_REVIEW_STALE",
        });
    });

    it("requires reprocessing when a review artifact used an older policy", async () => {
        const response = await handleCandidateResumeTextAcceptRequest(
            request(`/candidate/setup/resume-text/${artifactId}/accept`, {
                version: 1,
                revision: 1,
                reviewedText: "Inventory lead with shipping experience.",
            }),
            artifactId,
            dependencies({
                acceptReview: vi.fn(async () => {
                    throw new CandidateResumeArtifactRepositoryError("STALE_POLICY");
                }),
            }),
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Resume protection has been updated. Review this text again before using it.",
            code: "RESUME_REVIEW_POLICY_CHANGED",
        });
    });

    it("clears the exact setup-owned selection without reading resume content", async () => {
        const clearSelection = vi.fn(async () => ({ revision: 3 }));
        const response = await handleCandidateResumeSelectionClearRequest(
            new Request(`${origin}/candidate/setup/resume-text/selection`, {
                method: "DELETE",
                headers: { Origin: origin },
            }),
            dependencies({ clearSelection }),
        );

        expect(response.status).toBe(204);
        expect(clearSelection).toHaveBeenCalledWith({
            candidateProfileId,
            setupOwnerKey,
            now: new Date("2026-07-21T12:00:00.000Z"),
        });
    });
});

function dependencies(overrides: {
    resolveIdentity?: () => Promise<{ candidateProfileId: string; setupOwnerKey: string } | null>;
    createOrRecoverReviewArtifact?: CandidateResumeTextRouteDependencies["artifactRepository"]["createOrRecoverReviewArtifact"];
    acceptReview?: CandidateResumeTextRouteDependencies["artifactRepository"]["acceptReview"];
    clearSelection?: CandidateResumeTextRouteDependencies["selectionRepository"]["clearSelection"];
    finalizeSelectionOperation?: CandidateResumeTextRouteDependencies["selectionRepository"]["finalizeSelectionOperation"];
} = {}): CandidateResumeTextRouteDependencies {
    return {
        now: new Date("2026-07-21T12:00:00.000Z"),
        resolveIdentity: overrides.resolveIdentity ?? vi.fn(async () => ({ candidateProfileId, setupOwnerKey })),
        artifactRepository: {
            createOrRecoverReviewArtifact: overrides.createOrRecoverReviewArtifact ?? vi.fn(async () => artifact()),
            acceptReview: overrides.acceptReview ?? vi.fn(async () => ({ outcome: "accepted" as const, artifact: artifact({
                revision: 2,
                reviewState: "accepted",
                acceptedAt: "2026-07-21T12:01:00.000Z",
            }) })),
        },
        selectionRepository: {
            beginSelectionOperation: vi.fn(async () => ({ revision: 1 })),
            finalizeSelectionOperation: overrides.finalizeSelectionOperation ?? vi.fn(async () => true),
            abandonSelectionOperation: vi.fn(async () => false),
            clearSelection: overrides.clearSelection ?? vi.fn(async () => ({ revision: 2 })),
        },
    };
}

function request(path: string, body: unknown) {
    return new Request(`${origin}${path}`, {
        method: "POST",
        headers: {
            Origin: origin,
            "Content-Type": "application/json",
            "X-Candidate-Resume-Selection-Operation": operationId,
        },
        body: JSON.stringify(body),
    });
}

function artifact(overrides: Partial<CandidateResumeTextArtifact> = {}): CandidateResumeTextArtifact {
    return {
        artifactId,
        candidateProfileId,
        roleProfileId: null,
        version: 1,
        revision: 1,
        source: "pasted_text" as const,
        candidateLabel: "Pasted resume",
        normalizedText: "Inventory lead with shipping experience.",
        sourceFingerprint: "a".repeat(64),
        normalizedTextFingerprint: "b".repeat(64),
        processingPolicyVersion: "candidate_resume_text_processing_v1",
        piiPolicyVersion: "candidate_resume_direct_pii_v5",
        piiRedactionCounts: {
            known_name: 0,
            personal_detail: 0,
            email: 0,
            phone: 0,
            address: 0,
            date_of_birth: 0,
            government_identifier: 0,
            personal_url_or_handle: 0,
        },
        reviewState: "awaiting_review" as const,
        createdAt: "2026-07-21T12:00:00.000Z",
        acceptedAt: null,
        originalRetained: false as const,
        ...overrides,
    };
}
