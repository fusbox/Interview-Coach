import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    queryPostgresMock,
} = vi.hoisted(() => ({
    queryPostgresMock: vi.fn(),
}));

vi.mock("@/lib/server/db/postgres", () => ({
    queryPostgres: queryPostgresMock,
}));

describe("recruiter profile helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reads profile records from Postgres", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [{
                recruiter_id: "user-1",
                first_name: "Pat",
                last_name: "Lee",
                title: "Lead Recruiter",
                phone: "(555) 111-2222",
                timezone: "America/Chicago",
            }],
        });

        const { getRecruiterProfileRecord } = await import("./recruiter-profile");

        await expect(getRecruiterProfileRecord("user-1")).resolves.toMatchObject({
            recruiter_id: "user-1",
            first_name: "Pat",
            timezone: "America/Chicago",
        });
        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("from public.recruiter_profiles"),
            ["user-1"]
        );
    });

    it("upserts profile records through Postgres", async () => {
        queryPostgresMock.mockResolvedValue({
            rows: [{
                recruiter_id: "user-1",
                first_name: "Jordan",
                last_name: "Lee",
                title: "Talent Partner",
                phone: "(555) 222-3333",
                timezone: "America/New_York",
            }],
        });

        const { upsertRecruiterProfileRecord } = await import("./recruiter-profile");

        await expect(upsertRecruiterProfileRecord("user-1", {
            first_name: "Jordan",
            last_name: "Lee",
            title: "Talent Partner",
            phone: "(555) 222-3333",
            timezone: "America/New_York",
        })).resolves.toMatchObject({
            recruiter_id: "user-1",
            first_name: "Jordan",
            timezone: "America/New_York",
        });
        expect(queryPostgresMock).toHaveBeenCalledWith(
            expect.stringContaining("on conflict (recruiter_id)"),
            [
                "user-1",
                "Jordan",
                "Lee",
                "Talent Partner",
                "(555) 222-3333",
                "America/New_York",
            ]
        );
    });
});
