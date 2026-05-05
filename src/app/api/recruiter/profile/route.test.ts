import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    getAuthenticatedRouteUserMock,
    getRecruiterProfileRecordMock,
    upsertRecruiterProfileRecordMock,
} = vi.hoisted(() => ({
    getAuthenticatedRouteUserMock: vi.fn(),
    getRecruiterProfileRecordMock: vi.fn(),
    upsertRecruiterProfileRecordMock: vi.fn(),
}));

vi.mock("@/lib/server/auth/current-user", () => ({
    getAuthenticatedRouteUser: getAuthenticatedRouteUserMock,
}));

vi.mock("@/lib/server/auth/recruiter-profile", () => ({
    getRecruiterProfileRecord: getRecruiterProfileRecordMock,
    upsertRecruiterProfileRecord: upsertRecruiterProfileRecordMock,
}));

describe("/api/recruiter/profile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAuthenticatedRouteUserMock.mockResolvedValue({
            id: "11111111-1111-4111-8111-111111111111",
            email: "recruiter@example.com",
        });
        getRecruiterProfileRecordMock.mockResolvedValue({
            recruiter_id: "11111111-1111-4111-8111-111111111111",
            first_name: "Pat",
            last_name: "Lee",
            title: "Lead Recruiter",
            phone: "(555) 111-2222",
            timezone: "America/Chicago",
        });
        upsertRecruiterProfileRecordMock.mockResolvedValue({
            recruiter_id: "11111111-1111-4111-8111-111111111111",
            first_name: "Jordan",
            last_name: "Lee",
            title: "Lead Recruiter",
            phone: "(555) 111-2222",
            timezone: "America/Chicago",
        });
    });

    it("returns current user and profile", async () => {
        const { GET } = await import("./route");

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            user: {
                id: "11111111-1111-4111-8111-111111111111",
                email: "recruiter@example.com",
            },
            profileExists: true,
            profile: {
                first_name: "Pat",
            },
        });
    });

    it("saves current user profile updates", async () => {
        const { PUT } = await import("./route");

        const response = await PUT(new Request("http://localhost/api/recruiter/profile", {
            method: "PUT",
            body: JSON.stringify({
                first_name: "Jordan",
                last_name: "Lee",
                title: "Lead Recruiter",
                phone: "(555) 111-2222",
                timezone: "America/Chicago",
            }),
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            success: true,
            profile: {
                first_name: "Jordan",
            },
        });
        expect(upsertRecruiterProfileRecordMock).toHaveBeenCalledWith(
            "11111111-1111-4111-8111-111111111111",
            expect.objectContaining({
                first_name: "Jordan",
                timezone: "America/Chicago",
            })
        );
    });

    it("returns 401 when unauthenticated", async () => {
        getAuthenticatedRouteUserMock.mockResolvedValue(null);
        const { GET } = await import("./route");

        const response = await GET();

        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({
            code: "UNAUTHORIZED",
        });
    });
});
