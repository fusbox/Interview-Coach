import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const singleMock = vi.fn();
const updateMock = vi.fn();
const orMock = vi.fn();

vi.mock("@/lib/server/encryption", () => ({
    decrypt: vi.fn((value: string) => value),
    encrypt: vi.fn((value: string) => `encrypted:${value}`)
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: () => ({
        from: fromMock
    }),
    createAdminClient: () => ({
        rpc: rpcMock,
        from: fromMock
    })
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe("SupabaseSessionRepository.updatePartial", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        singleMock.mockResolvedValue({ data: { intake_json: {} } });
        eqMock.mockReturnValue({ single: singleMock });
        selectMock.mockReturnValue({ eq: eqMock });
        updateMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
        fromMock.mockImplementation((table: string) => {
            if (table === "sessions") {
                return {
                    select: selectMock,
                    update: updateMock
                };
            }

            return {
                upsert: vi.fn().mockResolvedValue({ error: null })
            };
        });
        rpcMock.mockResolvedValue({ error: null });
    });

    it("uses the atomic rpc for engagedTimeDelta updates", async () => {
        const { SupabaseSessionRepository } = await import("./supabase-session-repository");
        const repository = new SupabaseSessionRepository();

        await repository.updatePartial("session-1", { engagedTimeDelta: 7 });

        expect(rpcMock).toHaveBeenCalledWith("increment_session_engagement", {
            p_session_id: "session-1",
            p_delta_seconds: 7
        });
        expect(selectMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
    });

    it("still patches intake_json directly for absolute engagement values", async () => {
        const { SupabaseSessionRepository } = await import("./supabase-session-repository");
        const repository = new SupabaseSessionRepository();

        await repository.updatePartial("session-1", { engagedTimeSeconds: 12 });

        expect(selectMock).toHaveBeenCalled();
        expect(updateMock).toHaveBeenCalled();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it("encrypts invite tokens when patching session intake", async () => {
        const { SupabaseSessionRepository } = await import("./supabase-session-repository");
        const repository = new SupabaseSessionRepository();

        await repository.updatePartial("session-1", { inviteToken: "attempt-2-token" });

        expect(updateMock).toHaveBeenCalledWith({
            intake_json: {
                invite_token: "encrypted:attempt-2-token",
            },
        });
    });
});

describe("SupabaseSessionRepository.listByRecruiter", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        const orderListMock = vi.fn().mockResolvedValue({
            data: [
                {
                    session_id: "parent-1",
                    target_role: "QA Engineer",
                    status: "COMPLETED",
                    created_at: new Date("2026-03-16T00:00:00.000Z").toISOString(),
                    updated_at: new Date("2026-03-17T00:00:00.000Z").toISOString(),
                    intake_json: {
                        candidate: { firstName: "Cand", lastName: "Date", email: "cand@example.com" }
                    },
                    parent_session_id: null,
                    attempt_number: 1,
                    client_name: null,
                    invitation_sent_at: new Date("2026-03-16T00:00:00.000Z").toISOString(),
                    questions: [{ count: 3 }],
                    answers: [{ submitted_at: new Date("2026-03-16T00:10:00.000Z").toISOString() }]
                },
                {
                    session_id: "attempt-2",
                    target_role: "QA Engineer",
                    status: "IN_SESSION",
                    created_at: new Date("2026-03-17T01:00:00.000Z").toISOString(),
                    updated_at: new Date("2026-03-17T01:05:00.000Z").toISOString(),
                    intake_json: {},
                    parent_session_id: "parent-1",
                    attempt_number: 2,
                    client_name: null,
                    invitation_sent_at: null,
                    questions: [{ count: 3 }],
                    answers: [{ submitted_at: null }]
                }
            ],
            error: null
        });

        orMock.mockReturnValue({
            order: orderListMock
        });

        fromMock.mockImplementation((table: string) => {
            if (table === "sessions") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            or: orMock
                        })
                    })
                };
            }

            return {
                upsert: vi.fn().mockResolvedValue({ error: null })
            };
        });
    });

    it("includes repeat practice sessions that have a parent session but no invitation timestamp", async () => {
        const { SupabaseSessionRepository } = await import("./supabase-session-repository");
        const repository = new SupabaseSessionRepository();

        const sessions = await repository.listByRecruiter("recruiter-1");

        expect(sessions).toHaveLength(2);
        expect(sessions.find(session => session.id === "attempt-2")?.attemptNumber).toBe(2);
        expect(orMock).toHaveBeenCalledWith('invitation_sent_at.not.is.null,parent_session_id.not.is.null');
    });

    it("normalizes malformed summary rows without leaking invalid values into the domain shape", async () => {
        const orderListMock = vi.fn().mockResolvedValue({
            data: [
                {
                    session_id: "session-1",
                    target_role: "QA Engineer",
                    status: "COMPLETED",
                    created_at: "not-a-date",
                    updated_at: "",
                    intake_json: "bad-intake",
                    parent_session_id: null,
                    attempt_number: 0,
                    client_name: "",
                    invitation_sent_at: "also-bad",
                    questions: [{ count: "wrong-type" }],
                    answers: [{ submitted_at: null }]
                }
            ],
            error: null
        });

        orMock.mockReturnValue({
            order: orderListMock
        });

        fromMock.mockImplementation((table: string) => {
            if (table === "sessions") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            or: orMock
                        })
                    })
                };
            }

            return {
                upsert: vi.fn().mockResolvedValue({ error: null })
            };
        });

        const { SupabaseSessionRepository } = await import("./supabase-session-repository");
        const repository = new SupabaseSessionRepository();

        const [session] = await repository.listByRecruiter("recruiter-1");

        expect(session).toMatchObject({
            candidateName: "Anonymous Candidate",
            createdAt: 0,
            updatedAt: 0,
            questionCount: 0,
            answerCount: 1,
            submittedCount: 0
        });
        expect(session.attemptNumber).toBeUndefined();
        expect(session.clientName).toBeUndefined();
        expect(session.invitationSentAt).toBeUndefined();
    });
});

describe("SupabaseSessionRepository.get", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        const sessionsSingleMock = vi.fn().mockResolvedValue({
            data: {
                session_id: "session-1",
                recruiter_id: "recruiter-1",
                status: "AWAITING_EVAL",
                target_role: "QA Engineer",
                job_description: null,
                current_question_index: 0,
                intake_json: {
                    candidate: {
                        firstName: "Cand",
                        lastName: "Date",
                        email: "cand@example.com"
                    }
                },
                parent_session_id: null,
                attempt_number: 1,
                client_name: null,
                summary_narrative: null,
                updated_at: new Date().toISOString()
            },
            error: null
        });

        const questionsOrderMock = vi.fn().mockResolvedValue({
            data: [
                {
                    question_id: "question-1",
                    session_id: "session-1",
                    question_index: 0,
                    question_text: "Tell me about yourself",
                    category: "General"
                }
            ],
            error: null
        });

        const answersEqMock = vi.fn().mockResolvedValue({
            data: [
                {
                    question_id: "question-1",
                    session_id: "session-1",
                    final_text: "Answer",
                    draft_text: null,
                    submitted_at: new Date().toISOString(),
                    attempt_number: 1
                }
            ],
            error: null
        });

        const evalsEqMock = vi.fn().mockResolvedValue({
            data: [
                {
                    question_id: "question-1",
                    session_id: "session-1",
                    feedback_json: {
                        ack: "Good start",
                        meta: { tier: 1, modality: "text" },
                        contentPulse: {
                            dimension: "focus_relevance",
                            headline: "Tighter framing",
                            body: "Anchor your answer to the role.",
                            quote: "I worked on testing"
                        }
                    },
                    attempt_number: 1
                }
            ]
        });

        fromMock.mockImplementation((table: string) => {
            if (table === "sessions") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: sessionsSingleMock
                        })
                    })
                };
            }

            if (table === "questions") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: questionsOrderMock
                        })
                    })
                };
            }

            if (table === "answers") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: answersEqMock
                    })
                };
            }

            if (table === "eval_results") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: evalsEqMock
                    })
                };
            }

            return {
                upsert: vi.fn().mockResolvedValue({ error: null })
            };
        });
    });

    it("maps the DB awaiting status to the canonical domain status", async () => {
        const { SupabaseSessionRepository } = await import("./supabase-session-repository");
        const repository = new SupabaseSessionRepository();

        const session = await repository.get("session-1");

        expect(session?.status).toBe("AWAITING_EVALUATION");
    });

    it("drops malformed persisted analysis payloads instead of returning invalid session data", async () => {
        fromMock.mockImplementation((table: string) => {
            if (table === "sessions") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: {
                                    session_id: "session-1",
                                    recruiter_id: "recruiter-1",
                                    status: "IN_SESSION",
                                    target_role: "QA Engineer",
                                    job_description: null,
                                    current_question_index: 0,
                                    intake_json: { candidate: { firstName: "Cand", lastName: "Date", email: "cand@example.com" } },
                                    parent_session_id: null,
                                    attempt_number: 1,
                                    client_name: null,
                                    summary_narrative: null,
                                    updated_at: new Date().toISOString()
                                },
                                error: null
                            })
                        })
                    })
                };
            }

            if (table === "questions") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: vi.fn().mockResolvedValue({
                                data: [{ question_id: "question-1", session_id: "session-1", question_index: 0, question_text: "Q1", category: "General" }],
                                error: null
                            })
                        })
                    })
                };
            }

            if (table === "answers") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({
                            data: [{ question_id: "question-1", session_id: "session-1", final_text: "Answer", draft_text: null, submitted_at: null, attempt_number: 1 }],
                            error: null
                        })
                    })
                };
            }

            if (table === "eval_results") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({
                            data: [{ question_id: "question-1", session_id: "session-1", feedback_json: { ack: 7 }, attempt_number: 1 }]
                        })
                    })
                };
            }

            return {
                upsert: vi.fn().mockResolvedValue({ error: null })
            };
        });

        const { SupabaseSessionRepository } = await import("./supabase-session-repository");
        const repository = new SupabaseSessionRepository();

        const session = await repository.get("session-1");

        expect(session?.answers["question-1"]?.analysis).toBeUndefined();
    });

    it("normalizes malformed session metadata and candidate intake on get", async () => {
        fromMock.mockImplementation((table: string) => {
            if (table === "sessions") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: {
                                    session_id: "session-1",
                                    recruiter_id: "recruiter-1",
                                    status: "AWAITING_EVAL",
                                    target_role: "QA Engineer",
                                    job_description: null,
                                    current_question_index: 0,
                                    intake_json: {
                                        candidate: {
                                            firstName: 7,
                                            lastName: null,
                                            email: false,
                                            resumeText: ["bad"]
                                        },
                                        viewed_at: "not-a-date",
                                        entered_initials: 5,
                                        engaged_time_seconds: "20"
                                    },
                                    parent_session_id: null,
                                    attempt_number: 0,
                                    client_name: 42,
                                    summary_narrative: null,
                                    updated_at: "bad-date"
                                },
                                error: null
                            })
                        })
                    })
                };
            }

            if (table === "questions") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: vi.fn().mockResolvedValue({
                                data: [{ question_id: "question-1", session_id: "session-1", question_index: 0, question_text: "Q1", category: null }],
                                error: null
                            })
                        })
                    })
                };
            }

            if (table === "answers") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({
                            data: [],
                            error: null
                        })
                    })
                };
            }

            if (table === "eval_results") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({
                            data: []
                        })
                    })
                };
            }

            return {
                upsert: vi.fn().mockResolvedValue({ error: null })
            };
        });

        const { SupabaseSessionRepository } = await import("./supabase-session-repository");
        const repository = new SupabaseSessionRepository();

        const session = await repository.get("session-1");

        expect(session?.status).toBe("AWAITING_EVALUATION");
        expect(session?.candidate).toEqual({
            firstName: "",
            lastName: "",
            email: "",
            resumeText: undefined
        });
        expect(session?.viewedAt).toBeUndefined();
        expect(session?.enteredInitials).toBeUndefined();
        expect(session?.engagedTimeSeconds).toBe(0);
        expect(session?.attemptNumber).toBeUndefined();
        expect(session?.clientName).toBeUndefined();
        expect(session?.updatedAt).toBeUndefined();
    });
});
