import { fireEvent, render, screen, within } from "@testing-library/react";
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

it("supports pasted, uploaded, and photographed resume text sources", () => {
    render(<CandidateSetupExperience />);

    expect(screen.getByRole("button", { name: /paste text/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/upload file/i)).toHaveAttribute("accept", ".pdf,.doc,.docx,.txt,image/*");
    expect(screen.getByLabelText(/take photo/i)).toHaveAttribute("capture", "environment");

    const resume = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/upload file/i), { target: { files: [resume] } });

    expect(screen.getByRole("button", { name: /paste text/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Selected: resume.pdf/i)).toBeInTheDocument();
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

it("shows a progress transition after setup submission", () => {
    const createSession = vi.fn(() => new Promise<never>(() => {}));
    render(<CandidateSetupExperience createSession={createSession} />);

    expect(screen.getByRole("button", { name: /start practice/i })).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("button", { name: /start practice/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Required fields are marked with an asterisk.");
    expect(screen.getByLabelText("Target role *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Job description *")).toHaveAttribute("aria-invalid", "true");

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
});

it("submits a typed setup payload for the next transition", () => {
    const handleSetupReady = vi.fn();
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
        },
    });
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
