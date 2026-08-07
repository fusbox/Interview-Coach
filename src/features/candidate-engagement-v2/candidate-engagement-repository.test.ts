import { describe, expect, it, vi } from "vitest";

import {
    createCandidateEngagementRepository,
    type CandidateEngagementQueryClient,
} from "./candidate-engagement-repository";

describe("candidate engagement repository", () => {
    it("appends an idempotent ownership-scoped slice batch", async () => {
        const query = vi.fn<CandidateEngagementQueryClient["query"]>(async () => ({
            rows: [{
                session_owned: true,
                accepted_slice_count: 1,
                active_milliseconds: "9400",
                slice_count: 1,
                first_received_at: new Date("2026-08-05T15:00:10.000Z"),
                last_received_at: new Date("2026-08-05T15:00:10.000Z"),
            }],
        }));
        const repository = createCandidateEngagementRepository({ query });

        await expect(repository.appendSlices({
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            slices: [{
                engagementSliceId: "33333333-3333-4333-8333-333333333333",
                trackerInstanceId: "44444444-4444-4444-8444-444444444444",
                sequenceNumber: 1,
                activeMilliseconds: 9400,
                clientStartedAt: "2026-08-05T15:00:00.000Z",
                clientEndedAt: "2026-08-05T15:00:09.400Z",
                openedBy: "interaction",
                lastActivity: "answer_input",
                flushReason: "periodic",
            }],
        })).resolves.toEqual({
            sessionOwned: true,
            acceptedSliceCount: 1,
            activeMilliseconds: 9400,
            sliceCount: 1,
            firstReceivedAt: "2026-08-05T15:00:10.000Z",
            lastReceivedAt: "2026-08-05T15:00:10.000Z",
        });

        const [sql, values] = query.mock.calls[0];
        expect(sql).toContain("where session.candidate_practice_session_id = $1");
        expect(sql).toContain("and session.candidate_profile_id = $2");
        expect(sql).toContain("jsonb_to_recordset($3::jsonb)");
        expect(sql).toContain("on conflict do nothing");
        expect(typeof values?.[2]).toBe("string");
        expect(JSON.parse(String(values?.[2]))).toEqual([expect.objectContaining({
            engagement_slice_id: "33333333-3333-4333-8333-333333333333",
            active_milliseconds: 9400,
        })]);
    });

    it("returns no ownership without inventing accepted time", async () => {
        const repository = createCandidateEngagementRepository({
            query: vi.fn(async () => ({
                rows: [{
                    session_owned: false,
                    accepted_slice_count: 0,
                    active_milliseconds: "0",
                    slice_count: 0,
                    first_received_at: null,
                    last_received_at: null,
                }],
            })),
        });

        const result = await repository.appendSlices({
            candidatePracticeSessionId: "11111111-1111-4111-8111-111111111111",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            slices: [],
        });

        expect(result).toEqual(expect.objectContaining({
            sessionOwned: false,
            acceptedSliceCount: 0,
            activeMilliseconds: 0,
        }));
    });

    it("builds a minimized administrator read without exposing raw email", async () => {
        const query = vi.fn<CandidateEngagementQueryClient["query"]>(async () => ({
            rows: [{
                candidate_practice_session_id: "11111111-1111-4111-8111-111111111111",
                candidate_label: "Devon Carter",
                masked_email: "de••••@example.com",
                target_role: "Operations Coordinator",
                status: "completed",
                session_created_at: "2026-08-05T14:00:00.000Z",
                active_milliseconds: "125000",
                slice_count: 14,
                first_received_at: "2026-08-05T14:01:00.000Z",
                last_received_at: "2026-08-05T14:09:00.000Z",
            }],
        }));
        const repository = createCandidateEngagementRepository({ query });

        const rows = await repository.listAdminReport();

        expect(rows).toEqual([expect.objectContaining({
            candidateLabel: "Devon Carter",
            maskedEmail: "de••••@example.com",
            activeMilliseconds: 125000,
        })]);
        expect(JSON.stringify(rows)).not.toContain("devon.carter@example.com");
        expect(query.mock.calls[0]?.[0]).not.toContain("answer_submissions_json");
        expect(query.mock.calls[0]?.[0]).not.toContain("answer_analysis_snapshots_json");
        expect(query.mock.calls[0]?.[0]).not.toContain("profile.email as email");
    });
});
