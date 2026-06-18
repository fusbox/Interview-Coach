import { describe, expect, it, vi } from "vitest";

import type { InterviewSession } from "@/lib/domain/types";
import { PostgresSessionRepository } from "./postgres-session-repository";

describe("PostgresSessionRepository", () => {
    it("persists arbitrary session intake data while overlaying repository-managed fields", async () => {
        const session: InterviewSession = {
            id: "session-1",
            role: "Client Services Specialist",
            jobDescription: "Support clients.",
            status: "NOT_STARTED",
            questions: [
                {
                    id: "question-1",
                    text: "Tell me about a client support win.",
                    category: "Behavioral",
                    index: 0,
                },
            ],
            currentQuestionIndex: 0,
            answers: {},
            initialsRequired: false,
            candidate: {
                firstName: "Irma",
                lastName: "Castillo",
                email: "irma@example.com",
            },
            intakeData: {
                candidateProfileId: "candidate-profile-1",
                questionPlanSnapshot: {
                    interviewStage: "initial_interview",
                    questionCount: 3,
                    categoryCounts: {
                        screening: 0,
                        behavioral: 1,
                        culture_fit: 1,
                        case_scenario: 0,
                        technical_role_specific: 1,
                    },
                    slots: [
                        { id: "behavioral-1", index: 0, category: "behavioral" },
                        { id: "culture_fit-1", index: 1, category: "culture_fit" },
                        { id: "technical_role_specific-1", index: 2, category: "technical_role_specific" },
                    ],
                },
            },
        };

        const query = vi.fn(async (sql: string, values?: unknown[]) => {
            if (sql.includes("select intake_json")) {
                return {
                    rows: [
                        {
                            intake_json: {
                                existing_key: "keep-me",
                                candidate: {
                                    firstName: "Existing",
                                    lastName: "Candidate",
                                },
                            },
                        },
                    ],
                };
            }

            return { rows: [], rowCount: 1 };
        });
        const client = {
            query,
            release: vi.fn(),
        };
        const pool = {
            connect: vi.fn(async () => client),
        };
        const repository = new PostgresSessionRepository(pool as never);

        await repository.update(session);

        const sessionInsertCall = query.mock.calls.find(([sql]) =>
            typeof sql === "string" && sql.includes("insert into public.sessions")
        );
        expect(sessionInsertCall).toBeDefined();

        const values = sessionInsertCall?.[1] as unknown[];
        const intakeJson = JSON.parse(values[10] as string);

        expect(intakeJson).toMatchObject({
            existing_key: "keep-me",
            candidateProfileId: "candidate-profile-1",
            questionPlanSnapshot: {
                interviewStage: "initial_interview",
                questionCount: 3,
            },
            candidate: {
                firstName: "Irma",
                lastName: "Castillo",
                email: "irma@example.com",
            },
        });
    });
});
