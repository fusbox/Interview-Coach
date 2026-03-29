import type { InterviewSession, SessionSummary } from "@/lib/domain/types";
import type { User } from "@supabase/supabase-js";

const E2E_RECRUITER_COOKIE = "e2e-auth";
const E2E_RECRUITER_COOKIE_VALUE = "recruiter";

export const E2E_RECRUITER_ID = "00000000-0000-4000-8000-000000000001";
export const E2E_RECRUITER_EMAIL = "e2e.recruiter@example.com";

export function isServerE2EMode() {
    return process.env.E2E_TEST_MODE === "true";
}

export function isClientE2EMode() {
    return process.env.NEXT_PUBLIC_E2E_TEST_MODE === "true";
}

export function hasE2ERecruiterCookie(
    cookieStore: { get(name: string): { value: string } | undefined }
) {
    return cookieStore.get(E2E_RECRUITER_COOKIE)?.value === E2E_RECRUITER_COOKIE_VALUE;
}

export function getE2ERecruiterUser() {
    return {
        aud: "authenticated",
        id: E2E_RECRUITER_ID,
        email: E2E_RECRUITER_EMAIL,
        app_metadata: {
            provider: "email",
            providers: ["email"],
        },
        user_metadata: {},
        created_at: "2026-03-29T00:00:00.000Z",
    } satisfies User;
}

export function getE2ERecruiterProfile() {
    return {
        first_name: "E2E",
        last_name: "Recruiter",
        title: "QA Recruiter",
        company: "E2E Talent",
        phone: "555-0100",
        email: E2E_RECRUITER_EMAIL,
        timezone: "America/Chicago",
    };
}

export function getE2ERecruiterSessions(): SessionSummary[] {
    const now = Date.parse("2026-03-29T15:00:00.000Z");

    return [
        {
            id: "e2e-session-1",
            candidateName: "Morgan Candidate",
            candidateFirstName: "Morgan",
            candidateLastName: "Candidate",
            candidateEmail: "morgan.candidate@example.com",
            role: "Quality Engineer",
            status: "NOT_STARTED",
            createdAt: now - 60 * 60 * 1000,
            updatedAt: now - 30 * 60 * 1000,
            invitationSentAt: now - 25 * 60 * 1000,
            questionCount: 3,
            answerCount: 0,
            submittedCount: 0,
            inviteToken: "e2e-manage-token",
            engagedTimeSeconds: 0,
        },
        {
            id: "e2e-session-2",
            candidateName: "Taylor Progress",
            candidateFirstName: "Taylor",
            candidateLastName: "Progress",
            candidateEmail: "taylor.progress@example.com",
            role: "Operations Coordinator",
            status: "COMPLETED",
            createdAt: now - 2 * 60 * 60 * 1000,
            updatedAt: now - 45 * 60 * 1000,
            invitationSentAt: now - 110 * 60 * 1000,
            questionCount: 2,
            answerCount: 2,
            submittedCount: 2,
            inviteToken: "e2e-complete-token",
            engagedTimeSeconds: 420,
            enteredInitials: "TP",
        },
    ];
}

export function getE2EInterviewSession(id: string): InterviewSession | null {
    if (id !== "e2e-session-1") {
        return null;
    }

    return {
        id: "e2e-session-1",
        recruiterId: E2E_RECRUITER_ID,
        candidateName: "Morgan Candidate",
        role: "Quality Engineer",
        status: "NOT_STARTED",
        currentQuestionIndex: 0,
        initialsRequired: true,
        candidate: {
            firstName: "Morgan",
            lastName: "Candidate",
            email: "morgan.candidate@example.com",
        },
        inviteToken: "e2e-manage-token",
        engagedTimeSeconds: 0,
        questions: [
            {
                id: "e2e-question-1",
                index: 0,
                category: "Behavioral",
                text: "Tell me about a launch risk you caught before release.",
            },
            {
                id: "e2e-question-2",
                index: 1,
                category: "Technical",
                text: "How do you verify regression coverage before shipping?",
            },
            {
                id: "e2e-question-3",
                index: 2,
                category: "Situational",
                text: "How would you communicate a late-breaking blocker to hiring stakeholders?",
            },
        ],
        answers: {},
    };
}

export const e2eRecruiterCookie = {
    name: E2E_RECRUITER_COOKIE,
    value: E2E_RECRUITER_COOKIE_VALUE,
};
