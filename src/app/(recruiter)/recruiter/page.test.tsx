import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
    redirect: redirectMock,
}));

describe("recruiter shared-host landing alias", () => {
    it("routes /recruiter to the recruiter create experience", async () => {
        const { default: RecruiterLandingAlias } = await import("./page");

        RecruiterLandingAlias();

        expect(redirectMock).toHaveBeenCalledWith("/recruiter/create");
    });
});
