import { randomUUID } from "crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresFeedbackRepository } from "./postgres-feedback-repository";

const databaseUrl = process.env.POSTGRES_FEEDBACK_REPOSITORY_TEST_DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

runIntegration("PostgresFeedbackRepository integration", () => {
    let pool: Pool;
    let repository: PostgresFeedbackRepository;
    let recruiterId: string;
    let sessionId: string;

    beforeAll(async () => {
        if (!databaseUrl) {
            return;
        }

        pool = new Pool({ connectionString: databaseUrl });
        repository = new PostgresFeedbackRepository(pool);
        recruiterId = randomUUID();
        sessionId = randomUUID();

        await pool.query(
            `
                insert into public.app_users (
                    user_id,
                    email,
                    display_name,
                    email_verified_at
                )
                values ($1, $2, 'Feedback Owner', now())
            `,
            [recruiterId, `feedback-owner-${recruiterId}@example.invalid`]
        );

        await pool.query(
            `
                insert into public.sessions (
                    session_id,
                    recruiter_id,
                    status,
                    current_question_index,
                    target_role,
                    intake_json
                )
                values ($1, $2, 'NOT_STARTED', 0, 'Warehouse Associate', $3::jsonb)
            `,
            [
                sessionId,
                recruiterId,
                JSON.stringify({
                    candidate: {
                        firstName: "Feedback",
                        lastName: "Tester",
                        email: "feedback-candidate@example.invalid"
                    }
                })
            ]
        );
    });

    beforeEach(async () => {
        await pool.query(
            "delete from public.user_feedback where recruiter_id = $1 or session_id = $2",
            [recruiterId, sessionId]
        );
    });

    afterAll(async () => {
        if (!pool) {
            return;
        }

        await pool.query("delete from public.user_feedback where recruiter_id = $1 or session_id = $2", [recruiterId, sessionId]);
        await pool.query("delete from public.sessions where session_id = $1", [sessionId]);
        await pool.query("delete from public.app_users where user_id = $1", [recruiterId]);
        await pool.end();
    });

    it("captures session feedback and updates an existing session/type signal", async () => {
        await repository.capture({
            sessionId,
            type: "candidate_baseline",
            rating: 2,
            metadata: { source: "landing" }
        });

        await repository.capture({
            sessionId,
            type: "candidate_baseline",
            rating: 4,
            comment: "More prepared now",
            metadata: { source: "summary" }
        });

        const stored = await pool.query(
            "select rating, comment, metadata from public.user_feedback where session_id = $1 and type = 'candidate_baseline'",
            [sessionId]
        );
        expect(stored.rowCount).toBe(1);
        expect(stored.rows[0]).toMatchObject({
            rating: 4,
            comment: "More prepared now",
            metadata: { source: "summary" }
        });
    });

    it("captures recruiter feedback and returns admin view rows joined to session context", async () => {
        await repository.capture({
            sessionId,
            recruiterId,
            type: "recruiter_friction_invite",
            rating: 5,
            metadata: { recruiter_email: "recruiter@example.invalid" }
        });
        await repository.capture({
            recruiterId,
            type: "recruiter_preparedness",
            comment: "easy",
            metadata: { source: "preview" }
        });

        const adminRows = await repository.listAdminView();
        const sessionRow = adminRows.find((row) => row.session_id === sessionId);
        const recruiterOnlyRow = adminRows.find((row) => row.type === "recruiter_preparedness");

        expect(sessionRow).toMatchObject({
            recruiter_id: recruiterId,
            type: "recruiter_friction_invite",
            rating: 5,
            metadata: { recruiter_email: "recruiter@example.invalid" },
            sessions: {
                target_role: "Warehouse Associate",
                intake_json: {
                    candidate: {
                        firstName: "Feedback",
                        lastName: "Tester",
                        email: "feedback-candidate@example.invalid"
                    }
                }
            }
        });
        expect(recruiterOnlyRow).toMatchObject({
            recruiter_id: recruiterId,
            comment: "easy",
            sessions: null
        });
    });
});
