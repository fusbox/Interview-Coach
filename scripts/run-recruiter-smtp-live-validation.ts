import { createHash, randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

import { createCandidateQuestionPlan } from "../src/features/candidate-session-v2/candidate-question-plan";
import { createInvitedPracticeTokenVault } from "../src/features/recruiter-invites-v2/invited-practice-token-vault";
import { createRecruiterDashboardRepository } from "../src/features/recruiter-invites-v2/recruiter-dashboard-repository";
import { createRecruiterInvitationDeliveryProvider } from "../src/features/recruiter-invites-v2/recruiter-invitation-delivery-provider";
import { createRecruiterInvitationDeliveryRepository } from "../src/features/recruiter-invites-v2/recruiter-invitation-delivery-repository";
import { deliverRecruiterInvitationBatch } from "../src/features/recruiter-invites-v2/recruiter-invitation-delivery-service";
import { createRecruiterInvitationHandoffRepository } from "../src/features/recruiter-invites-v2/recruiter-invitation-handoff-repository";
import { createRecruiterInvitationRepository } from "../src/features/recruiter-invites-v2/recruiter-invitation-repository";
import { createRecruiterInvitationAggregate } from "../src/features/recruiter-invites-v2/recruiter-invitation-service";
import {
    createRecruiterSmtpLiveValidationSummary,
    readRecruiterSmtpLiveValidationConfig,
    RecruiterSmtpLiveValidationGuardError,
} from "../src/features/recruiter-invites-v2/recruiter-smtp-live-validation";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const DEV_RECRUITER_ID = "20000000-0000-4000-8000-000000000001";

loadEnvConfig(process.cwd());

class RecruiterSmtpLiveValidationFailure extends Error {
    constructor(readonly code: string, message: string) {
        super(message);
        this.name = "RecruiterSmtpLiveValidationFailure";
    }
}

async function main() {
    const config = readRecruiterSmtpLiveValidationConfig(process.env);
    const validationRunId = `smtp-${createHash("sha256").update(randomUUID()).digest("hex").slice(0, 12)}`;
    const pool = new Pool({
        connectionString: getSmokeDatabaseUrl(),
        application_name: "interview-coach-recruiter-smtp-live-validation",
        max: 5,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });
    let batchId: string | null = null;
    let verification: Omit<Parameters<typeof createRecruiterSmtpLiveValidationSummary>[0], "temporaryAggregateRemoved"> | null = null;
    let temporaryAggregateRemoved = false;

    try {
        await assertSeededRecruiter(pool);
        const queryClient = { query: (sql: string, values: unknown[]) => pool.query(sql, values) };
        const invitationRepository = createRecruiterInvitationRepository(queryClient);
        const deliveryRepository = createRecruiterInvitationDeliveryRepository(queryClient);
        const tokenVault = createInvitedPracticeTokenVault(process.env);
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 1,
        });
        const questionWordingSnapshot = {
            status: "questions_worded" as const,
            questions: questionPlanSnapshot.slots.map((slot) => ({
                slotId: slot.id,
                index: slot.index,
                category: slot.category,
                questionText: "Tell me about a process you improved after noticing a preventable error.",
            })),
        };
        const aggregate = await createRecruiterInvitationAggregate({
            recruiterId: DEV_RECRUITER_ID,
            idempotencyKey: `smtp-live-create-${randomUUID()}`,
            targetRole: "SMTP delivery validation",
            jobDescription: "Synthetic code-owned invitation used only to validate the approved SMTP transport.",
            interviewStage: "screening",
            questionPlanSnapshot,
            questionWordingSnapshot,
            recipients: [{
                firstName: "SMTP",
                lastName: "Validation",
                email: config.recipientEmail,
                requisitionReference: validationRunId,
            }],
            tokenTtlSeconds: 60 * 60,
        }, { repository: invitationRepository, tokenVault });
        batchId = aggregate.batchId;

        const smtpProvider = createRecruiterInvitationDeliveryProvider(process.env);
        let providerCallCount = 0;
        const countedProvider = {
            name: smtpProvider.name,
            async send(input: Parameters<typeof smtpProvider.send>[0]) {
                providerCallCount += 1;
                return smtpProvider.send(input);
            },
        };
        const delivered = await deliverRecruiterInvitationBatch({
            recruiterId: DEV_RECRUITER_ID,
            recruiterName: "Interview Coach validation",
            batchId,
            actionKey: `smtp-live-send-${randomUUID()}`,
            appOrigin: config.appOrigin,
        }, {
            invitationRepository,
            deliveryRepository,
            provider: countedProvider,
            tokenVault,
        });
        const first = delivered.recipients[0];
        if (delivered.recipients.length !== 1 || first?.status !== "provider_accepted" || first.attemptNumber !== 1) {
            throw failure(
                "provider_not_accepted",
                `SMTP provider acceptance was not recorded (${first?.failureCode ?? first?.status ?? "missing_result"}).`,
            );
        }

        const freshHandoffRepository = createRecruiterInvitationHandoffRepository({
            query: (sql, values = []) => pool.query(sql, values),
        });
        const handoff = await freshHandoffRepository.findOwnedHandoffFact(DEV_RECRUITER_ID, batchId);
        const handoffRecovered = handoff?.recipients.length === 1
            && handoff.recipients[0]?.delivery?.lifecycleState === "provider_accepted"
            && handoff.recipients[0]?.delivery?.attemptNumber === 1;

        const freshDashboardRepository = createRecruiterDashboardRepository({
            query: (sql, values = []) => pool.query(sql, values),
        });
        const dashboardFacts = await freshDashboardRepository.listOwnedRecipientFacts(DEV_RECRUITER_ID);
        const dashboardRecovered = dashboardFacts.some((fact) => (
            fact.batchId === batchId
            && fact.deliveryLifecycleState === "provider_accepted"
            && fact.deliveryAttemptNumber === 1
        ));

        const replay = await deliverRecruiterInvitationBatch({
            recruiterId: DEV_RECRUITER_ID,
            recruiterName: "Interview Coach validation",
            batchId,
            actionKey: `smtp-live-second-action-${randomUUID()}`,
            appOrigin: config.appOrigin,
        }, {
            invitationRepository: createRecruiterInvitationRepository(queryClient),
            deliveryRepository: createRecruiterInvitationDeliveryRepository(queryClient),
            provider: countedProvider,
            tokenVault,
        });
        const replayRecipient = replay.recipients[0];
        const acceptedResendSuppressed = replay.recipients.length === 1
            && replayRecipient?.status === "provider_accepted"
            && replayRecipient.attemptNumber === 1
            && providerCallCount === 1;

        const foreignRecruiterId = randomUUID();
        const foreignHandoff = await freshHandoffRepository.findOwnedHandoffFact(foreignRecruiterId, batchId);
        const foreignDashboard = await freshDashboardRepository.listOwnedRecipientFacts(foreignRecruiterId);
        const ownerFenceVerified = foreignHandoff === null
            && !foreignDashboard.some((fact) => fact.batchId === batchId);

        verification = {
            validationRunId,
            attemptNumber: first.attemptNumber,
            handoffRecovered,
            dashboardRecovered,
            acceptedResendSuppressed,
            providerCallCount,
            ownerFenceVerified,
        };
    } finally {
        if (batchId) {
            await pool.query(`
                delete from public.recruiter_invitation_batches
                where recruiter_invitation_batch_id = $1
                  and recruiter_id = $2
            `, [batchId, DEV_RECRUITER_ID]).catch(() => undefined);
            const remaining = await pool.query(`
                select 1
                from public.recruiter_invitation_batches
                where recruiter_invitation_batch_id = $1
                  and recruiter_id = $2
            `, [batchId, DEV_RECRUITER_ID]).catch(() => ({ rows: [{ exists: true }] }));
            temporaryAggregateRemoved = remaining.rows.length === 0;
        }
        await pool.end();
    }

    if (!verification) {
        throw failure("verification_incomplete", "Live SMTP validation ended before its durable checks completed.");
    }
    const summary = createRecruiterSmtpLiveValidationSummary({
        ...verification,
        temporaryAggregateRemoved,
    });
    console.log(JSON.stringify(summary, null, 2));
}

async function assertSeededRecruiter(pool: Pool) {
    const result = await pool.query(`
        select 1
        from public.app_users app_user
        join public.app_user_roles app_role
          on app_role.user_id = app_user.user_id
         and app_role.role = 'recruiter'
        where app_user.user_id = $1
          and app_user.status = 'active'
        limit 1
    `, [DEV_RECRUITER_ID]);
    if (result.rows.length !== 1) {
        throw failure(
            "recruiter_seed_required",
            "The disposable database must contain the local recruiter seed before live SMTP validation.",
        );
    }
}

function failure(code: string, message: string) {
    return new RecruiterSmtpLiveValidationFailure(code, message);
}

main().catch((error) => {
    if (error instanceof RecruiterSmtpLiveValidationGuardError || error instanceof RecruiterSmtpLiveValidationFailure) {
        console.error(`Recruiter SMTP live validation stopped [${error.code}]: ${error.message}`);
    } else {
        console.error("Recruiter SMTP live validation stopped [unexpected_error]. No provider acceptance is claimed.");
    }
    process.exitCode = 1;
});
