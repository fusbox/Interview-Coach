import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createAiEvalOperatorAccessRepository } from "../src/features/ai-eval-v2/ai-eval-operator-access";
import { createAiEvalRemediationRepository } from "../src/features/ai-eval-v2/ai-eval-remediation-repository";
import { createAiEvalReviewRepository } from "../src/features/ai-eval-v2/ai-eval-review-repository";
import { createAiEvalWorkbenchRepository } from "../src/features/ai-eval-v2/ai-eval-workbench-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-ai-eval-foundation-smoke",
    });
    const client = await pool.connect();
    const operatorUserId = randomUUID();
    const ungrantedUserId = randomUUID();
    const questionSetId = randomUUID();
    const laterQuestionSetId = randomUUID();

    try {
        await client.query("begin");
        await client.query(`
            insert into public.app_users (user_id, email, display_name, status)
            values
              ($1, $3, 'AI eval operator smoke', 'active'),
              ($2, $4, 'Ungrantable by role smoke', 'active')
        `, [
            operatorUserId,
            ungrantedUserId,
            `ai-eval-operator-${operatorUserId}@example.invalid`,
            `ai-eval-ungranted-${ungrantedUserId}@example.invalid`,
        ]);
        await client.query(`
            insert into public.app_user_roles (user_id, role)
            values
              ($1, 'recruiter'),
              ($1, 'qa'),
              ($2, 'admin'),
              ($2, 'qa')
        `, [operatorUserId, ungrantedUserId]);
        await client.query(`
            insert into public.ai_eval_operator_grants (
              user_id,
              granted_by_user_id,
              reason
            ) values ($1, $1, 'Disposable foundation smoke')
        `, [operatorUserId]);

        const questionPlan = {
            status: "candidate_question_plan_v1",
            interviewStage: "screening",
            questionCount: 1,
            slots: [{ id: "q1", index: 0, category: "screening" }],
        };
        const questionWording = {
            status: "questions_worded",
            questions: [{
                slotId: "q1",
                index: 0,
                category: "screening",
                questionText: "What interests you about this quality role?",
            }],
        };
        await client.query(`
            insert into public.recruiter_invitation_question_sets (
              recruiter_invitation_question_set_id,
              recruiter_id,
              action_key_hash,
              request_fingerprint,
              source,
              lifecycle_state,
              target_role,
              job_description,
              interview_stage,
              question_plan_snapshot_json,
              question_wording_snapshot_json,
              accepted_at,
              expires_at
            ) values (
              $1, $2, $3, $4, 'generated', 'ready',
              'Quality operator smoke',
              'Inspect products, document defects, and follow safety requirements.',
              'screening', $5::jsonb, $6::jsonb, now(), now() + interval '1 hour'
            )
        `, [
            questionSetId,
            operatorUserId,
            sha256(`action:${questionSetId}`),
            sha256(`request:${questionSetId}`),
            JSON.stringify(questionPlan),
            JSON.stringify(questionWording),
        ]);

        const query = (sql: string, values?: unknown[]) => client.query(sql, values);
        const accessRepository = createAiEvalOperatorAccessRepository({ query });
        const workbenchRepository = createAiEvalWorkbenchRepository({ query });
        const reviewRepository = createAiEvalReviewRepository({ query });
        const remediationRepository = createAiEvalRemediationRepository({ query });

        assert(await accessRepository.findActiveGrant(operatorUserId), "Named operator grant did not resolve.");
        assert(await accessRepository.findActiveGrant(ungrantedUserId) === null, "App roles inherited AI-eval access.");

        const workItem = await workbenchRepository.createWorkItem({
            operatorUserId,
            sourceKind: "recruiter_question_wording",
            sourceId: questionSetId,
            selectionReason: "production_sample",
            assignedOperatorUserId: operatorUserId,
        });
        assert(workItem?.audience === "recruiter_invite", "Source-derived audience was not persisted.");
        assert(workItem.interviewStage === "screening", "Source-derived interview stage was not persisted.");

        const replayedWorkItem = await workbenchRepository.createWorkItem({
            operatorUserId,
            sourceKind: "recruiter_question_wording",
            sourceId: questionSetId,
            selectionReason: "production_sample",
            assignedOperatorUserId: operatorUserId,
        });
        assert(
            replayedWorkItem?.workItemId === workItem.workItemId,
            "Repeated exact-source promotion did not converge on the existing work item.",
        );

        const ungrantedPromotion = await workbenchRepository.createWorkItem({
            operatorUserId: ungrantedUserId,
            sourceKind: "recruiter_question_wording",
            sourceId: questionSetId,
            selectionReason: "manual",
        });
        assert(ungrantedPromotion === null, "An ungranted admin/QA account promoted a work item.");

        const ungrantedQueue = await workbenchRepository.listWorkItems(ungrantedUserId);
        assert(ungrantedQueue.length === 0, "An ungranted admin/QA account read the work queue.");

        const detail = await workbenchRepository.findWorkItemDetail(operatorUserId, workItem.workItemId);
        assert(detail?.sourcePayload.questionWording, "Exact generated question source did not resolve.");

        const review = await reviewRepository.createDraftReview({
            operatorUserId,
            workItemId: workItem.workItemId,
            rubricVersion: "question_wording_rubric_v1",
        });
        assert(review?.lifecycleState === "draft", "Draft review was not created.");
        const findingRequestKey = randomUUID();
        const reviewWithFinding = await reviewRepository.saveDraftReviewWithFinding({
            operatorUserId,
            reviewId: review.reviewId,
            revision: review.revision,
            disposition: null,
            severity: null,
            confidence: null,
            layerJudgments: { question_wording: "partly_correct" },
            reviewSummary: "One wording choice needs refinement.",
            creationRequestKey: findingRequestKey,
            layer: "question_wording",
            failureLabel: "question_ambiguous",
            findingSeverity: "minor",
            sourceReference: { slotId: "q1" },
            rationale: "The smoke finding proves structured source references and rationale.",
        });
        assert(reviewWithFinding, "Structured finding was not created atomically with the draft save.");
        const findingId = reviewWithFinding.findingId;
        const replayedFinding = await reviewRepository.saveDraftReviewWithFinding({
            operatorUserId,
            reviewId: review.reviewId,
            revision: review.revision,
            disposition: null,
            severity: null,
            confidence: null,
            layerJudgments: { question_wording: "partly_correct" },
            reviewSummary: "One wording choice needs refinement.",
            creationRequestKey: findingRequestKey,
            layer: "question_wording",
            failureLabel: "question_ambiguous",
            findingSeverity: "minor",
            sourceReference: { slotId: "q1" },
            rationale: "The smoke finding proves structured source references and rationale.",
        });
        assert(replayedFinding?.findingId === findingId, "A response-lost finding command did not recover its exact result.");
        const mismatchedReplay = await reviewRepository.saveDraftReviewWithFinding({
            operatorUserId,
            reviewId: review.reviewId,
            revision: review.revision,
            disposition: null,
            severity: null,
            confidence: null,
            layerJudgments: { question_wording: "partly_correct" },
            reviewSummary: "One wording choice needs refinement.",
            creationRequestKey: findingRequestKey,
            layer: "question_wording",
            failureLabel: "question_ambiguous",
            findingSeverity: "minor",
            sourceReference: { slotId: "q1" },
            rationale: "Changed content must not reuse the request key.",
        });
        assert(mismatchedReplay === null, "Changed finding content reused an existing request key.");
        const revisionAfterMismatch = await client.query<{ revision: number }>(`
            select revision
            from public.ai_eval_reviews
            where ai_eval_review_id = $1
        `, [review.reviewId]);
        assert(
            revisionAfterMismatch.rows[0]?.revision === reviewWithFinding.review.revision,
            "Changed request-key reuse advanced the review revision.",
        );

        const submitted = await reviewRepository.submitReview({
            operatorUserId,
            reviewId: review.reviewId,
            revision: reviewWithFinding.review.revision,
            disposition: "needs_improvement",
            severity: "minor",
            confidence: "high",
            layerJudgments: { question_wording: "partly_correct", question_set: "correct" },
            reviewSummary: "The set is valid; one wording choice needs refinement.",
        });
        assert(submitted?.lifecycleState === "submitted", "Review was not submitted.");

        let submittedFindingFrozen = false;
        await client.query("savepoint submitted_finding_mutation");
        try {
            await client.query(`
                update public.ai_eval_findings
                set rationale = 'This mutation must fail.'
                where ai_eval_finding_id = $1
            `, [findingId]);
        } catch (error) {
            submittedFindingFrozen = readPostgresCode(error) === "55000";
            await client.query("rollback to savepoint submitted_finding_mutation");
        }
        await client.query("release savepoint submitted_finding_mutation");
        assert(submittedFindingFrozen, "A finding changed after review submission.");

        const remediationRequestKey = randomUUID();
        const remediationId = await remediationRepository.createRemediationWithFindings({
            operatorUserId,
            creationRequestKey: remediationRequestKey,
            targetComponent: "question_wording",
            title: "Clarify ambiguous generated questions",
            hypothesis: "A narrower wording instruction will reduce ambiguity.",
            expectedChange: "Questions preserve role grounding while asking one clear thing.",
            regressionRisks: "Over-constraining wording could make questions repetitive.",
            findingIds: [findingId],
        });
        assert(remediationId, "Remediation hypothesis was not created.");
        const replayedRemediationId = await remediationRepository.createRemediationWithFindings({
            operatorUserId,
            creationRequestKey: remediationRequestKey,
            targetComponent: "question_wording",
            title: "Clarify ambiguous generated questions",
            hypothesis: "A narrower wording instruction will reduce ambiguity.",
            expectedChange: "Questions preserve role grounding while asking one clear thing.",
            regressionRisks: "Over-constraining wording could make questions repetitive.",
            findingIds: [findingId],
        });
        assert(replayedRemediationId === remediationId, "Exact remediation replay did not converge.");

        const regressionCaseId = await remediationRepository.promoteRegressionCase({
            operatorUserId,
            remediationId,
            findingId,
        });
        assert(regressionCaseId, "Representative finding was not promoted to a regression case.");

        let prematureVerificationRejected = false;
        await client.query("savepoint premature_verification");
        try {
            await client.query(`
                update public.ai_eval_remediations
                set
                  lifecycle_state = 'verified',
                  change_kind = 'prompt',
                  changed_reference = 'prompt:smoke-v2',
                  verification_note = 'This must not verify without a recheck.',
                  last_updated_by_operator_user_id = $2,
                  revision = revision + 1
                where ai_eval_remediation_id = $1
            `, [remediationId, operatorUserId]);
        } catch (error) {
            prematureVerificationRejected = readPostgresCode(error) === "23514";
            await client.query("rollback to savepoint premature_verification");
        }
        await client.query("release savepoint premature_verification");
        assert(prematureVerificationRejected, "A remediation verified without a fixed regression recheck.");

        let remediation = await remediationRepository.findRemediation(operatorUserId, remediationId);
        assert(remediation, "Remediation detail did not resolve.");
        assert(await remediationRepository.updateRemediation({
            operatorUserId,
            remediationId,
            revision: remediation.revision,
            lifecycleState: "planned",
            changeKind: null,
            changedReference: null,
            verificationNote: null,
        }), "Remediation did not advance to planned.");
        remediation = await remediationRepository.findRemediation(operatorUserId, remediationId);
        assert(remediation && await remediationRepository.updateRemediation({
            operatorUserId,
            remediationId,
            revision: remediation.revision,
            lifecycleState: "changed",
            changeKind: "prompt",
            changedReference: "prompt:smoke-v2",
            verificationNote: null,
        }), "Remediation did not record the governed change.");
        remediation = await remediationRepository.findRemediation(operatorUserId, remediationId);
        assert(remediation && await remediationRepository.updateRemediation({
            operatorUserId,
            remediationId,
            revision: remediation.revision,
            lifecycleState: "ready_for_recheck",
            changeKind: "prompt",
            changedReference: "prompt:smoke-v2",
            verificationNote: null,
        }), "Remediation did not advance to ready for recheck.");

        await client.query(`
            insert into public.recruiter_invitation_question_sets (
              recruiter_invitation_question_set_id,
              recruiter_id,
              action_key_hash,
              request_fingerprint,
              source,
              lifecycle_state,
              target_role,
              job_description,
              interview_stage,
              question_plan_snapshot_json,
              question_wording_snapshot_json,
              accepted_at,
              expires_at,
              created_at
            ) values (
              $1, $2, $3, $4, 'generated', 'ready',
              'Quality operator smoke follow-up',
              'Inspect products and document defects.',
              'screening', $5::jsonb, $6::jsonb, clock_timestamp(), now() + interval '1 hour',
              clock_timestamp() + interval '1 second'
            )
        `, [
            laterQuestionSetId,
            operatorUserId,
            sha256(`action:${laterQuestionSetId}`),
            sha256(`request:${laterQuestionSetId}`),
            JSON.stringify(questionPlan),
            JSON.stringify({
                ...questionWording,
                questions: [{
                    ...questionWording.questions[0],
                    questionText: "Which quality-inspection responsibility best matches your experience?",
                }],
            }),
        ]);
        const laterWorkItem = await workbenchRepository.createWorkItem({
            operatorUserId,
            sourceKind: "recruiter_question_wording",
            sourceId: laterQuestionSetId,
            selectionReason: "golden",
            assignedOperatorUserId: operatorUserId,
        });
        assert(laterWorkItem, "Later exact source did not promote for recheck.");
        const laterReview = await reviewRepository.createDraftReview({
            operatorUserId,
            workItemId: laterWorkItem.workItemId,
            rubricVersion: "question_wording_rubric_v1",
        });
        assert(laterReview, "Later exact source review did not start.");
        const submittedLaterReview = await reviewRepository.submitReview({
            operatorUserId,
            reviewId: laterReview.reviewId,
            revision: laterReview.revision,
            disposition: "acceptable",
            severity: "informational",
            confidence: "high",
            layerJudgments: { question_wording: "correct", question_set: "correct" },
            reviewSummary: "The later exact output no longer exhibits the original ambiguity.",
        });
        assert(submittedLaterReview, "Later exact source review was not submitted.");
        const recheckCandidates = await remediationRepository.listRecheckCandidates(operatorUserId, remediationId);
        const recheckTiming = await client.query(`
            select ai_eval_work_item_id, surface, source_occurred_at, lifecycle_state
            from public.ai_eval_work_items
            where ai_eval_work_item_id in ($1, $2)
            order by source_occurred_at
        `, [workItem.workItemId, laterWorkItem.workItemId]);
        assert(
            recheckCandidates.some((candidate) => candidate.reviewId === submittedLaterReview.reviewId),
            `Later reviewed source was not eligible for recheck: ${JSON.stringify({ recheckCandidates, recheckTiming: recheckTiming.rows })}`,
        );

        let originalOutputRejected = false;
        await client.query("savepoint original_output_recheck");
        try {
            await remediationRepository.recordRecheck({
                operatorUserId,
                remediationId,
                regressionCaseId,
                verificationReviewId: review.reviewId,
                outcome: "fixed",
                verificationNote: "This must fail because it is the original output.",
            });
        } catch (error) {
            originalOutputRejected = readPostgresCode(error) === "23514";
            await client.query("rollback to savepoint original_output_recheck");
        }
        await client.query("release savepoint original_output_recheck");
        assert(originalOutputRejected, "The original output was accepted as its own recheck.");

        const recheckId = await remediationRepository.recordRecheck({
            operatorUserId,
            remediationId,
            regressionCaseId,
            verificationReviewId: submittedLaterReview.reviewId,
            outcome: "fixed",
            verificationNote: "The later reviewed wording asks one clear, role-grounded question.",
        });
        assert(recheckId, "Fixed sequential recheck was not recorded.");
        const replayedRecheckId = await remediationRepository.recordRecheck({
            operatorUserId,
            remediationId,
            regressionCaseId,
            verificationReviewId: submittedLaterReview.reviewId,
            outcome: "fixed",
            verificationNote: "The later reviewed wording asks one clear, role-grounded question.",
        });
        assert(replayedRecheckId === recheckId, "Exact recheck replay did not converge.");

        remediation = await remediationRepository.findRemediation(operatorUserId, remediationId);
        assert(remediation && await remediationRepository.updateRemediation({
            operatorUserId,
            remediationId,
            revision: remediation.revision,
            lifecycleState: "verified",
            changeKind: "prompt",
            changedReference: "prompt:smoke-v2",
            verificationNote: "Every promoted regression case has a latest fixed recheck.",
        }), "Remediation did not verify after fixed regression coverage.");
        const originalLifecycle = await client.query<{ lifecycle_state: string }>(`
            select lifecycle_state
            from public.ai_eval_work_items
            where ai_eval_work_item_id = $1
        `, [workItem.workItemId]);
        assert(originalLifecycle.rows[0]?.lifecycle_state === "verified", "Original work item did not reconcile to verified.");

        const audit = await client.query(`
            select event_type, metadata
            from public.auth_audit_events
            where user_id = $1
              and event_type like 'ai_eval_%'
            order by created_at, event_id
        `, [operatorUserId]);
        assert(audit.rows.some((row) => row.event_type === "ai_eval_source_detail_read"), "Source detail read was not audited.");
        const auditText = JSON.stringify(audit.rows).toLowerCase();
        assert(!auditText.includes("quality operator smoke"), "Audit metadata copied source role content.");
        assert(!auditText.includes("inspect products"), "Audit metadata copied source JD content.");
        assert(!auditText.includes("what interests you"), "Audit metadata copied generated question content.");

        await client.query(`
            update public.ai_eval_operator_grants
            set
              lifecycle_state = 'revoked',
              revoked_by_user_id = $1,
              revoked_at = now()
            where user_id = $1
              and lifecycle_state = 'active'
        `, [operatorUserId]);
        assert(await accessRepository.findActiveGrant(operatorUserId) === null, "Revoked operator access remained active.");
        assert((await workbenchRepository.listWorkItems(operatorUserId)).length === 0, "Revoked operator retained queue access.");

        console.log(JSON.stringify({
            individualGrantRequired: true,
            inheritedRolesRejected: true,
            sourceMetadataDerived: true,
            idempotentSourcePromotion: true,
            atomicIdempotentFindingSave: true,
            changedFindingReplayRejectedWithoutRevisionAdvance: true,
            exactSourceRead: true,
            metadataOnlyAudit: true,
            submittedReviewFrozen: true,
            remediationLinked: true,
            exactRemediationReplay: true,
            regressionCasePromoted: true,
            prematureVerificationRejected: true,
            originalOutputRejectedAsRecheck: true,
            laterSameSurfaceRecheckRecorded: true,
            exactRecheckReplay: true,
            verifiedOnlyAfterFixedCoverage: true,
            revocationEffective: true,
        }, null, 2));
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

function sha256(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function readPostgresCode(error: unknown) {
    if (!error || typeof error !== "object" || !("code" in error)) return null;
    return typeof error.code === "string" ? error.code : null;
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
