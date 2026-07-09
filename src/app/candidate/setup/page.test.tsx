import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CandidateSetupPage from "./page";
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
    render(<CandidateSetupPage />);

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
    render(<CandidateSetupPage />);

    expect(screen.getByRole("button", { name: /paste text/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/upload file/i)).toHaveAttribute("accept", ".pdf,.doc,.docx,.txt,image/*");
    expect(screen.getByLabelText(/take photo/i)).toHaveAttribute("capture", "environment");

    const resume = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/upload file/i), { target: { files: [resume] } });

    expect(screen.getByRole("button", { name: /paste text/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Selected: resume.pdf/i)).toBeInTheDocument();
});

it("changes the recommended question count when the interview stage changes", () => {
    render(<CandidateSetupPage />);

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
