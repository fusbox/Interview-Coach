import { describe, expect, it, vi } from "vitest";

import { CandidateResumePhotoOcrRuntimeError } from "./candidate-resume-photo-ocr-provider";
import {
    GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_CONFIGURATION_FINGERPRINT,
    GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_MODEL,
    GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ID,
    createGoogleCandidateResumePhotoOcrRuntime,
} from "./google-candidate-resume-photo-ocr";

describe("Google candidate resume photo OCR", () => {
    it("sends image pages in exact order under the pinned structured profile", async () => {
        const generateContent = vi.fn(async () => ({
            text: JSON.stringify({
                pages: [
                    { pageNumber: 1, text: "Inventory lead." },
                    { pageNumber: 2, text: "Shipping coordinator." },
                ],
            }),
            candidates: [{ finishReason: "STOP" }],
        }));
        const runtime = createGoogleCandidateResumePhotoOcrRuntime({
            transport: { generateContent: generateContent as never },
        });

        await expect(runtime.ocr({
            pages: [
                { pageNumber: 1, bytes: Uint8Array.of(1, 2), mimeType: "image/jpeg" },
                { pageNumber: 2, bytes: Uint8Array.of(3, 4), mimeType: "image/heic" },
            ],
        })).resolves.toEqual({
            pages: [
                { pageNumber: 1, text: "Inventory lead." },
                { pageNumber: 2, text: "Shipping coordinator." },
            ],
        });

        expect(runtime.profileId).toBe(GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_PROFILE_ID);
        expect(runtime.configurationFingerprint).toBe(GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_CONFIGURATION_FINGERPRINT);
        expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
            model: GOOGLE_CANDIDATE_RESUME_PHOTO_OCR_MODEL,
            contents: [{
                role: "user",
                parts: [
                    { text: "Resume page 1 follows." },
                    { inlineData: { data: Buffer.from([1, 2]).toString("base64"), mimeType: "image/jpeg" } },
                    { text: "Resume page 2 follows." },
                    { inlineData: { data: Buffer.from([3, 4]).toString("base64"), mimeType: "image/heic" } },
                    { text: "Transcribe the 2 supplied resume pages in exact order." },
                ],
            }],
            config: expect.objectContaining({
                responseMimeType: "application/json",
                temperature: 0,
                candidateCount: 1,
                seed: 0,
                responseJsonSchema: expect.objectContaining({ required: ["pages"] }),
                thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
                httpOptions: { timeout: 45_000 },
            }),
        }));
    });

    it("rejects missing, reordered, malformed, and safety-blocked provider output", async () => {
        for (const response of [
            { text: JSON.stringify({ pages: [{ pageNumber: 2, text: "Wrong order" }] }), candidates: [{ finishReason: "STOP" }] },
            { text: "not-json", candidates: [{ finishReason: "STOP" }] },
            { text: JSON.stringify({ pages: [{ pageNumber: 1, text: "Text" }] }), candidates: [{ finishReason: "SAFETY" }] },
        ]) {
            const runtime = createGoogleCandidateResumePhotoOcrRuntime({
                transport: { generateContent: async () => response as never },
            });
            await expect(runtime.ocr({
                pages: [{ pageNumber: 1, bytes: Uint8Array.of(1), mimeType: "image/jpeg" }],
            })).rejects.toBeInstanceOf(CandidateResumePhotoOcrRuntimeError);
        }
    });

    it("maps provider transport detail to bounded failure classes", async () => {
        const runtime = createGoogleCandidateResumePhotoOcrRuntime({
            transport: {
                generateContent: async () => {
                    throw Object.assign(new Error("private provider detail"), { status: 429 });
                },
            },
        });
        await expect(runtime.ocr({
            pages: [{ pageNumber: 1, bytes: Uint8Array.of(1), mimeType: "image/jpeg" }],
        })).rejects.toEqual(expect.objectContaining({ failureClass: "provider_rate_limited" }));
    });
});
