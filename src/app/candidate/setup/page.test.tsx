import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CandidateSetupExperience } from "@/features/candidate-setup-v2/CandidateSetupExperience";
import {
    CANDIDATE_SETUP_DRAFT_STORAGE_KEY,
    createCandidateSetupMemoryDraftStore,
    saveCandidateSetupDraft,
} from "@/features/candidate-setup-v2/candidate-setup-draft-store";

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

it("renders the candidate setup inputs with required markers", () => {
    render(<CandidateSetupExperience />);

    expect(screen.getByRole("heading", { name: "Practice Setup" })).toBeInTheDocument();
    expect(screen.getByText(/Tell me what interview you are preparing for\. After setup/i)).toBeInTheDocument();
    expect(screen.queryByText(/Start with the role and job description/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Target role *")).toBeRequired();
    expect(screen.getByLabelText("Job description *")).toBeRequired();
    expect(screen.getByText("Interview stage *")).toBeInTheDocument();
    expect(screen.getByText("Question count *")).toBeInTheDocument();
    expect(screen.getByLabelText("Paste resume text")).toBeInTheDocument();
});

it("processes document upload separately from image capture without saving raw file content", async () => {
    const handleSetupReady = vi.fn();
    const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
            artifact: createDocumentReviewArtifact("awaiting_review", 1),
        }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
            outcome: "accepted",
            artifact: createDocumentReviewArtifact("accepted", 2),
        }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CandidateSetupExperience onSetupReady={handleSetupReady} />);

    expect(screen.getByRole("button", { name: /paste text/i })).toHaveAttribute("aria-pressed", "true");
    const documentInput = screen.getByLabelText(/upload resume/i);
    expect(documentInput).toHaveAttribute(
        "accept",
        ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(documentInput.getAttribute("accept")).not.toContain("image/");
    expect(documentInput.getAttribute("accept")).not.toMatch(/(?:^|,)\.doc(?:,|$)/);
    expect(documentInput.getAttribute("accept")).not.toContain(".txt");

    const photoInput = screen.getByLabelText(/take photo/i);
    expect(photoInput).toHaveAttribute("accept", "image/*");
    expect(photoInput).toHaveAttribute("capture", "environment");

    const resume = new File(["%PDF-1.4 private-pdf-bytes"], "resume.pdf", { type: "application/pdf" });
    await act(async () => {
        fireEvent.change(documentInput, { target: { files: [resume] } });
    });

    expect(screen.getByRole("button", { name: /paste text/i })).toHaveAttribute("aria-pressed", "false");
    expect(await screen.findByText(/Selected: resume.pdf. Prepared text is ready for your review./i)).toBeInTheDocument();
    expect(screen.getByLabelText("Review resume text")).toHaveValue("Supported a high-volume front desk.");
    expect(window.localStorage.getItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY) ?? "").not.toContain("private-pdf-bytes");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/candidate/setup/resume-document", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
            "Content-Type": "application/pdf",
            "X-Resume-Document-Name": "resume.pdf",
            "X-Candidate-Resume-Selection-Operation": expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
        body: resume,
    }));

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /use this resume/i }));
    });
    expect(await screen.findByText(/Selected: resume.pdf. Reviewed text is ready to use./i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Customer service representative" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Help customers resolve service questions." },
    });
    fireEvent.click(screen.getByRole("button", { name: /start practice/i }));

    expect(handleSetupReady).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
            resumeText: "Supported a high-volume front desk.",
            resumeCaptureMode: "document_upload",
            resumeArtifact: expect.objectContaining({
                source: "document_upload",
                reviewState: "accepted",
                revision: 2,
            }),
        }),
    }));

});

it("queues, reorders, OCRs, reviews, and accepts resume photos without persisting image bytes", async () => {
    const handleSetupReady = vi.fn();
    const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
            artifact: createPhotoReviewArtifact("awaiting_review", 1),
        }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
            outcome: "accepted",
            artifact: createPhotoReviewArtifact("accepted", 2),
        }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CandidateSetupExperience onSetupReady={handleSetupReady} />);

    const firstPage = new File(["first-private-photo"], "page-1.jpg", { type: "image/jpeg" });
    const secondPage = new File(["second-private-photo"], "page-2.heic", { type: "image/heic" });
    await act(async () => {
        fireEvent.change(screen.getByLabelText(/take photo/i), { target: { files: [firstPage] } });
    });
    await act(async () => {
        fireEvent.change(screen.getByLabelText(/choose photos/i), { target: { files: [secondPage] } });
    });

    expect(screen.getByRole("list", { name: /resume photo page order/i })).toHaveTextContent("Page 1page-1.jpg");
    expect(screen.getByRole("list", { name: /resume photo page order/i })).toHaveTextContent("Page 2page-2.heic");
    fireEvent.click(screen.getByRole("button", { name: "Move page 1 down" }));

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /review photo text/i }));
    });

    const submitted = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/candidate/setup/resume-photo", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
            "X-Candidate-Resume-Selection-Operation": expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
    }));
    expect(submitted.getAll("pages").map((value) => value instanceof File ? value.name : "")).toEqual([
        "page-2.heic",
        "page-1.jpg",
    ]);
    expect(screen.queryByRole("list", { name: /resume photo page order/i })).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Review resume text")).toHaveValue("Managed inventory and shipments.");
    expect(window.localStorage.getItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY) ?? "").not.toContain("private-photo");

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /use this resume/i }));
    });
    fireEvent.change(screen.getByLabelText("Target role *"), { target: { value: "Inventory lead" } });
    fireEvent.change(screen.getByLabelText("Job description *"), { target: { value: "Manage inventory and shipments." } });
    fireEvent.click(screen.getByRole("button", { name: /start practice/i }));

    expect(handleSetupReady).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
            resumeText: "Managed inventory and shipments.",
            resumeCaptureMode: "photo_capture",
            resumeArtifact: expect.objectContaining({
                source: "photo_capture",
                reviewState: "accepted",
                revision: 2,
            }),
        }),
    }));
});

it("changes the recommended question count when the interview stage changes", () => {
    render(<CandidateSetupExperience />);

    expect(screen.getAllByText("7 questions")).toHaveLength(2);
    expect(screen.getByText(/I recommend 7 questions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /final interview/i }));

    expect(screen.getAllByText("10 questions")).toHaveLength(2);
    expect(screen.getByText(/I recommend 10 questions/i)).toBeInTheDocument();
    expect(screen.getByText(/you can choose a different count/i)).toBeInTheDocument();
});

it("shows a progress transition after setup submission", async () => {
    const createSession = vi.fn(() => new Promise<never>(() => {}));
    render(<CandidateSetupExperience createSession={createSession} />);

    expect(screen.getByRole("button", { name: /start practice/i })).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("button", { name: /start practice/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Required fields are marked with an asterisk.");
    expect(screen.getByLabelText("Target role *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Job description *")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByLabelText("Target role *")).toHaveFocus());

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Customer service representative" },
    });

    expect(screen.getByLabelText("Target role *")).toHaveAttribute("aria-invalid", "false");

    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Help customers resolve service questions." },
    });

    expect(screen.getByText("Ready when you are")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start practice/i })).toHaveAttribute("aria-disabled", "false");

    fireEvent.click(screen.getByRole("button", { name: /start practice/i }));

    expect(screen.getByText(/Building your practice plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Preparing the transition into your first session/i)).toBeInTheDocument();
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
        status: "ready_for_session_creation",
    }));
});

it("shows setup contract errors before posting invalid setup input", async () => {
    const createSession = vi.fn();
    render(<CandidateSetupExperience createSession={createSession} />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Material handler" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "a".repeat(12_001) },
    });

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });

    expect(createSession).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Job description must be 12,000 characters or fewer.");
    expect(screen.getByLabelText("Job description *")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByLabelText("Job description *")).toHaveFocus());
});

it("requires resume processing and acceptance before submitting the reviewed artifact", async () => {
    const handleSetupReady = vi.fn();
    const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
            artifact: createResumeReviewArtifact("awaiting_review", 1),
        }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
            outcome: "accepted",
            artifact: createResumeReviewArtifact("accepted", 2),
        }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CandidateSetupExperience onSetupReady={handleSetupReady} />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: " Customer service representative " },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: " Help customers resolve service questions. " },
    });
    fireEvent.change(screen.getByLabelText("Paste resume text"), {
        target: { value: " Supported a high-volume front desk. " },
    });
    expect(screen.getByRole("button", { name: /start practice/i })).toHaveAttribute("aria-disabled", "true");
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /review resume/i }));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: /use this resume/i })).toBeInTheDocument());
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /use this resume/i }));
    });
    await waitFor(() => expect(screen.getByText("Resume ready")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /screening call/i }));
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: /start practice/i }));

    expect(handleSetupReady).toHaveBeenCalledWith({
        status: "ready_for_session_creation",
        nextRoute: "/candidate/session/[sessionId]",
        payload: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: "Supported a high-volume front desk.",
            interviewStage: "screening",
            questionCount: 3,
            resumeCaptureMode: "pasted_text",
            resumeArtifact: createResumeArtifactReference(2),
        },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("returns an older-policy review to the processing step without losing its text", async () => {
    const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
            artifact: createResumeReviewArtifact("awaiting_review", 1),
        }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
            error: "Resume protection has been updated. Review this text again before using it.",
            code: "RESUME_REVIEW_POLICY_CHANGED",
        }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CandidateSetupExperience />);

    fireEvent.change(screen.getByLabelText("Paste resume text"), {
        target: { value: "Supported a high-volume front desk." },
    });
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /review resume/i }));
    });
    await act(async () => {
        fireEvent.click(await screen.findByRole("button", { name: /use this resume/i }));
    });

    expect(await screen.findByRole("button", { name: /review resume/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Paste resume text")).toHaveValue("Supported a high-volume front desk.");
    expect(screen.getByText(/resume protection has been updated/i)).toBeInTheDocument();
});

it("returns an accepted stale-policy artifact to review when setup start rejects it", async () => {
    const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
            artifact: createResumeReviewArtifact("awaiting_review", 1),
        }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
            outcome: "accepted",
            artifact: createResumeReviewArtifact("accepted", 2),
        }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
            error: "That resume review is no longer current. Review the resume again before starting practice.",
            code: "RESUME_REVIEW_STALE",
        }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CandidateSetupExperience />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Customer service representative" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Help customers resolve service questions." },
    });
    fireEvent.change(screen.getByLabelText("Paste resume text"), {
        target: { value: "Supported a high-volume front desk." },
    });
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /review resume/i }));
    });
    await act(async () => {
        fireEvent.click(await screen.findByRole("button", { name: /use this resume/i }));
    });
    fireEvent.click(screen.getByRole("button", { name: /screening call/i }));
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });

    expect(await screen.findByRole("button", { name: /review resume/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Paste resume text")).toHaveValue("Supported a high-volume front desk.");
    expect(screen.getByText(/resume review is no longer current/i)).toBeInTheDocument();
});

it("can create a provisional session transition through the setup boundary", () => {
    const createSession = vi.fn(() => new Promise<never>(() => {}));
    render(<CandidateSetupExperience createSession={createSession} />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Customer service representative" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Help customers resolve service questions." },
    });
    fireEvent.click(screen.getByRole("button", { name: /start practice/i }));

    expect(createSession).toHaveBeenCalledWith({
        status: "ready_for_session_creation",
        nextRoute: "/candidate/session/[sessionId]",
        payload: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 7,
            resumeCaptureMode: "none",
        },
    });
});

it("shows a setup-start error if the session boundary rejects the payload", async () => {
    const createSession = vi.fn(async () => {
        throw new Error("No session today.");
    });
    const draftStore = createCandidateSetupMemoryDraftStore();
    render(<CandidateSetupExperience createSession={createSession} draftOwnerKey="candidate:demo" draftStore={draftStore} />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Customer service representative" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Help customers resolve service questions." },
    });

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("I could not start this practice round. Try again.");
    expect(draftStore.readDraft("candidate:demo")).toMatchObject({
        targetRole: "Customer service representative",
        jobDescription: "Help customers resolve service questions.",
    });
});

it("shows the safe provider failure and preserves the setup draft for an explicit retry", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe("/candidate/setup/start");
        expect(init?.method).toBe("POST");

        return new Response(JSON.stringify({
            error: "Practice questions could not be prepared. Your setup is still available, so you can try again.",
            code: "QUESTION_WORDING_PROVIDER_PROVIDER_UNAVAILABLE",
            retryable: true,
        }), {
            status: 503,
            headers: { "content-type": "application/json" },
        });
    });
    vi.stubGlobal("fetch", fetchMock);
    const draftStore = createCandidateSetupMemoryDraftStore();
    render(<CandidateSetupExperience draftOwnerKey="candidate:demo" draftStore={draftStore} />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Warehouse quality inspector" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Inspect finished goods, record defects, and follow safety procedures." },
    });

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
        "Practice questions could not be prepared. Your setup is still available, so you can try again.",
    );
    expect(screen.getByRole("button", { name: /start practice/i })).toBeEnabled();
    expect(draftStore.readDraft("candidate:demo")).toMatchObject({
        targetRole: "Warehouse quality inspector",
        jobDescription: "Inspect finished goods, record defects, and follow safety procedures.",
        setupStartRequest: {
            requestSignature: expect.any(String),
            idempotencyKey: expect.any(String),
        },
    });

    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders["Idempotency-Key"]).toEqual(expect.any(String));

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });

    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(secondHeaders["Idempotency-Key"]).toBe(firstHeaders["Idempotency-Key"]);
});

it("offers candidate-owned existing practice facts instead of silently reusing a matching context", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: {
            ...window.location,
            assign,
        },
    });
    const draftStore = createCandidateSetupMemoryDraftStore();
    const createSession = vi.fn(async () => ({
        status: "existing_prep_context_found" as const,
        existingPrepContexts: [{
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            targetRole: "Quality control inspector",
            jobDescription: "Inspect finished goods and document production defects.",
            interviewStage: "screening" as const,
            questionCount: 5,
            createdAt: "2026-07-01T12:00:00.000Z",
            lastPracticeActivityAt: "2026-07-14T12:00:00.000Z",
            completedSessionCount: 2,
            completedQuestionCount: 9,
            activeRound: {
                completedQuestionCount: 2,
                totalQuestionCount: 5,
            },
        }],
    }));
    render(<CandidateSetupExperience
        createSession={createSession}
        draftOwnerKey="candidate:demo"
        draftStore={draftStore}
    />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Quality control inspector" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Inspect finished goods and document production defects." },
    });

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });

    const dialog = screen.getByRole("dialog", { name: /already have practice for this role/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quality control inspector" })).toBeInTheDocument();
    expect(screen.getByText("Jul 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Jul 14, 2026")).toBeInTheDocument();
    expect(within(dialog).getByText("Screening call")).toBeInTheDocument();
    expect(screen.getByText("2 of 5 completed")).toBeInTheDocument();
    expect(screen.getByText("Completed sessions").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Completed questions").nextSibling).toHaveTextContent("9");

    fireEvent.click(screen.getByRole("button", { name: "View in dashboard" }));

    expect(assign).toHaveBeenCalledWith(
        "/candidate/dashboard?prep=33333333-3333-4333-8333-333333333333",
    );
    expect(draftStore.readDraft("candidate:demo")).toBeNull();
});

it("creates an independent prep profile only after the candidate chooses a separate path", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: {
            ...window.location,
            assign,
        },
    });
    const existingResult = {
        status: "existing_prep_context_found" as const,
        existingPrepContexts: [{
            roleProfileId: "33333333-3333-4333-8333-333333333333",
            targetRole: "Material handler",
            jobDescription: "Move and label materials.",
            interviewStage: "first_interview" as const,
            questionCount: 7,
            createdAt: "2026-07-01T12:00:00.000Z",
            lastPracticeActivityAt: "2026-07-14T12:00:00.000Z",
            completedSessionCount: 1,
            completedQuestionCount: 7,
            activeRound: null,
        }],
    };
    const createdResult = setupSessionResult("new-separate-session");
    const createSession = vi.fn()
        .mockResolvedValueOnce(existingResult)
        .mockResolvedValueOnce(createdResult);
    render(<CandidateSetupExperience createSession={createSession} />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Material handler" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Move and label materials." },
    });

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Start a separate path" }));
    });

    expect(createSession).toHaveBeenNthCalledWith(2, expect.objectContaining({
        status: "ready_for_session_creation",
    }), {
        action: "create_separate_path",
        matchingRoleProfileId: "33333333-3333-4333-8333-333333333333",
    });
    expect(assign).toHaveBeenCalledWith("/candidate/session/new-separate-session");
});

it("keeps the choice dialog and setup draft available when separate-path creation fails", async () => {
    const draftStore = createCandidateSetupMemoryDraftStore();
    const createSession = vi.fn()
        .mockResolvedValueOnce({
            status: "existing_prep_context_found" as const,
            existingPrepContexts: [{
                roleProfileId: "33333333-3333-4333-8333-333333333333",
                targetRole: "Material handler",
                jobDescription: "Move and label materials.",
                interviewStage: "first_interview" as const,
                questionCount: 7,
                createdAt: "2026-07-01T12:00:00.000Z",
                lastPracticeActivityAt: "2026-07-14T12:00:00.000Z",
                completedSessionCount: 1,
                completedQuestionCount: 7,
                activeRound: null,
            }],
        })
        .mockRejectedValueOnce(new Error("Database unavailable"));
    render(<CandidateSetupExperience
        createSession={createSession}
        draftOwnerKey="candidate:demo"
        draftStore={draftStore}
    />);

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Material handler" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Move and label materials." },
    });

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Start a separate path" }));
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your setup is still here");
    expect(draftStore.readDraft("candidate:demo")).toMatchObject({
        targetRole: "Material handler",
        jobDescription: "Move and label materials.",
    });
});

it("clears the setup draft after a successful provisional session is created", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: {
            ...window.location,
            assign,
        },
    });
    const draftStore = createCandidateSetupMemoryDraftStore();
    saveCandidateSetupDraft(draftStore, "candidate:demo", {
        targetRole: "Warehouse lead",
        jobDescription: "Coordinate safety workflows.",
        interviewStage: "first_interview",
        questionCount: 7,
    });
    const createSession = vi.fn(async () => ({
        status: "session_created" as const,
        sessionId: "candidate-session-123",
        nextRoute: "/candidate/session/candidate-session-123" as const,
        setupSnapshot: {
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-09T15:00:00.000Z",
        },
        questionPlanSnapshot: {
            interviewStage: "first_interview" as const,
            questionCount: 7,
            categoryCounts: {
                screening: 2,
                behavioral: 2,
                culture_fit: 1,
                case_scenario: 1,
                technical_role_specific: 1,
            },
            slots: [],
        },
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [],
        },
    }));
    render(<CandidateSetupExperience createSession={createSession} draftOwnerKey="candidate:demo" draftStore={draftStore} />);

    expect(screen.getByLabelText("Target role *")).toHaveValue("Warehouse lead");

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /start practice/i }));
    });

    expect(draftStore.readDraft("candidate:demo")).toBeNull();
    expect(assign).toHaveBeenCalledWith("/candidate/session/candidate-session-123");
});

it("restores and autosaves a candidate setup draft for the same owner key", () => {
    const draftStore = createCandidateSetupMemoryDraftStore();
    saveCandidateSetupDraft(draftStore, "candidate:demo", {
        targetRole: "Warehouse lead",
        jobDescription: "Coordinate safety workflows.",
        resumeText: "Led daily standups.",
        resumeArtifact: createResumeArtifactReference(2),
        interviewStage: "follow_up",
        questionCount: 7,
    });

    render(<CandidateSetupExperience draftOwnerKey="candidate:demo" draftStore={draftStore} />);

    expect(screen.getByLabelText("Target role *")).toHaveValue("Warehouse lead");
    expect(screen.getByLabelText("Job description *")).toHaveValue("Coordinate safety workflows.");
    expect(screen.getByLabelText("Paste resume text")).toHaveValue("Led daily standups.");
    expect(screen.getByRole("button", { name: /follow-up interview/i })).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Warehouse supervisor" },
    });

    expect(draftStore.readDraft("candidate:demo")).toMatchObject({
        targetRole: "Warehouse supervisor",
        jobDescription: "Coordinate safety workflows.",
        resumeText: "Led daily standups.",
        interviewStage: "follow_up",
        questionCount: 7,
    });
});

it("prefills and locks server-trusted host role context without overriding candidate-selected details", () => {
    const draftStore = createCandidateSetupMemoryDraftStore();
    saveCandidateSetupDraft(draftStore, "candidate:demo", {
        targetRole: "Browser-supplied role",
        jobDescription: "Browser-supplied description.",
        resumeText: "Candidate resume text.",
        resumeArtifact: createResumeArtifactReference(2),
        interviewStage: "follow_up",
        questionCount: 7,
    });

    render(<CandidateSetupExperience
        draftOwnerKey="candidate:demo"
        draftStore={draftStore}
        trustedSetupContext={{
            sourcePlatform: "talentarbor",
            jobCollectionId: "555",
            requirementId: "777",
            targetRole: "Warehouse Associate",
            jobDescription: "Pick, pack, and prepare shipments safely.",
            jobDescriptionHash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
        }}
    />);

    expect(screen.getByText("Role details provided by TalentArbor.")).toBeInTheDocument();
    expect(screen.getByLabelText("Target role *")).toHaveValue("Warehouse Associate");
    expect(screen.getByLabelText("Target role *")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Job description *")).toHaveValue("Pick, pack, and prepare shipments safely.");
    expect(screen.getByLabelText("Job description *")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Paste resume text")).toHaveValue("Candidate resume text.");
    expect(screen.getByRole("button", { name: /follow-up interview/i })).toHaveAttribute("aria-pressed", "true");
});

it("restores an unfinished server-owned resume review without browser source bytes", () => {
    render(<CandidateSetupExperience
        draftOwnerKey="candidate:demo"
        initialResumeArtifact={createDocumentReviewArtifact("awaiting_review", 1)}
    />);

    expect(screen.getByLabelText("Review resume text")).toHaveValue("Supported a high-volume front desk.");
    expect(screen.getByText(/Selected: resume.pdf. Prepared text is ready for your review./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use this resume/i })).toBeEnabled();
    expect(window.localStorage.getItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY) ?? "").not.toContain("Supported a high-volume front desk.");
});

function createResumeArtifactReference(revision: number) {
    return {
        artifactId: "20000000-0000-4000-8000-000000000001",
        version: 1,
        revision,
        source: "pasted_text" as const,
        candidateLabel: "Pasted resume",
        reviewState: "accepted" as const,
    };
}

function createResumeReviewArtifact(reviewState: "awaiting_review" | "accepted", revision: number) {
    return {
        ...createResumeArtifactReference(revision),
        reviewState,
        normalizedText: "Supported a high-volume front desk.",
        piiRedactionCounts: {},
        createdAt: "2026-07-21T12:00:00.000Z",
        acceptedAt: reviewState === "accepted" ? "2026-07-21T12:01:00.000Z" : null,
    };
}

function createDocumentReviewArtifact(reviewState: "awaiting_review" | "accepted", revision: number) {
    return {
        ...createResumeReviewArtifact(reviewState, revision),
        source: "document_upload" as const,
        candidateLabel: "resume.pdf",
    };
}

function createPhotoReviewArtifact(reviewState: "awaiting_review" | "accepted", revision: number) {
    return {
        ...createResumeReviewArtifact(reviewState, revision),
        source: "photo_capture" as const,
        candidateLabel: "2 resume photos",
        normalizedText: "Managed inventory and shipments.",
    };
}

it("does not hydrate with different ready-state markup when a browser draft exists", async () => {
    const previousWindow = globalThis.window;
    const previousStorage = globalThis.localStorage;
    const browserDraft = createCandidateSetupMemoryDraftStore();
    saveCandidateSetupDraft(browserDraft, "candidate:local", {
        targetRole: "Mobile restored role",
        jobDescription: "This draft should wait until hydration.",
        interviewStage: "final",
        questionCount: 10,
    });
    const storedDraft = browserDraft.readDraft("candidate:local");

    window.localStorage.setItem(CANDIDATE_SETUP_DRAFT_STORAGE_KEY, JSON.stringify({
        "candidate:local": storedDraft,
    }));

    let html = "";
    try {
        Reflect.deleteProperty(globalThis, "window");
        Reflect.deleteProperty(globalThis, "localStorage");

        html = renderToString(<CandidateSetupExperience />);

        expect(html).toContain("Your first round");
        expect(html).not.toContain("Ready when you are");
        expect(html).not.toContain("Mobile restored role");
    } finally {
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: previousWindow,
        });
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            value: previousStorage,
        });
    }

    const recoverableErrors: unknown[] = [];
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
        hydrateRoot(container, <CandidateSetupExperience />, {
            onRecoverableError(error) {
                recoverableErrors.push(error);
            },
        });
    });

    expect(recoverableErrors).toHaveLength(0);
    document.body.removeChild(container);
});

function setupSessionResult(sessionId: string) {
    return {
        status: "session_created" as const,
        sessionId,
        nextRoute: `/candidate/session/${sessionId}` as const,
        setupSnapshot: {
            targetRole: "Material handler",
            jobDescription: "Move and label materials.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-15T15:00:00.000Z",
        },
        questionPlanSnapshot: {
            interviewStage: "first_interview" as const,
            questionCount: 7,
            categoryCounts: {
                screening: 2,
                behavioral: 2,
                culture_fit: 1,
                case_scenario: 1,
                technical_role_specific: 1,
            },
            slots: [],
        },
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [],
        },
    };
}
