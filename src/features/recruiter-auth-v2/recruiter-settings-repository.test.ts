import { describe, expect, it, vi } from "vitest";

import { createRecruiterSettingsRepository } from "./recruiter-settings-repository";

describe("recruiter settings repository", () => {
    it("reads only an active recruiter or admin account", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [settingsRow()] });
        const repository = createRecruiterSettingsRepository({ query });

        await expect(repository.findOwnedSettings("user-1")).resolves.toEqual({
            senderDisplayName: "Dev Recruiter",
            email: "dev@example.invalid",
            revision: REVISION,
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("app_user.status = 'active'"), ["user-1"]);
        expect(query.mock.calls[0]?.[0]).toContain("role.role in ('recruiter', 'admin')");
    });

    it("updates the account with its expected revision and requires one audit event", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{ ...settingsRow(), display_name: "Fu Chen", outcome: "updated", audit_count: "1" }],
        });
        const repository = createRecruiterSettingsRepository({ query });

        await expect(repository.updateOwnedSettings({
            userId: "user-1",
            senderDisplayName: "Fu Chen",
            revision: REVISION,
        })).resolves.toEqual({
            outcome: "updated",
            settings: {
                senderDisplayName: "Fu Chen",
                email: "dev@example.invalid",
                revision: REVISION,
            },
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("recruiter_display_name_updated"), [
            "user-1",
            "Fu Chen",
            REVISION,
        ]);
        expect(query.mock.calls[0]?.[0]).toContain("jsonb_build_array('display_name')");
        expect(query.mock.calls[0]?.[0]).not.toContain("old_display_name");
    });

    it("treats an exact replay as unchanged without requiring a second audit event", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{ ...settingsRow(), outcome: "unchanged", audit_count: "0" }],
        });
        const repository = createRecruiterSettingsRepository({ query });

        await expect(repository.updateOwnedSettings({
            userId: "user-1",
            senderDisplayName: "Dev Recruiter",
            revision: "2026-07-20T11:00:00.000000Z",
        })).resolves.toMatchObject({ outcome: "unchanged" });
    });

    it("fails closed for stale revisions and accounts outside the owner and role fence", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ ...settingsRow(), outcome: "conflict", audit_count: "0" }] })
            .mockResolvedValueOnce({ rows: [] });
        const repository = createRecruiterSettingsRepository({ query });

        await expect(repository.updateOwnedSettings({
            userId: "user-1",
            senderDisplayName: "Another Name",
            revision: "2026-07-20T11:00:00.000000Z",
        })).resolves.toEqual({ outcome: "conflict" });
        await expect(repository.updateOwnedSettings({
            userId: "foreign-user",
            senderDisplayName: "Another Name",
            revision: REVISION,
        })).resolves.toEqual({ outcome: "not_found" });
    });

    it("rejects an update that did not persist its metadata-only audit event", async () => {
        const repository = createRecruiterSettingsRepository({
            query: vi.fn().mockResolvedValue({
                rows: [{ ...settingsRow(), outcome: "updated", audit_count: "0" }],
            }),
        });

        await expect(repository.updateOwnedSettings({
            userId: "user-1",
            senderDisplayName: "Fu Chen",
            revision: REVISION,
        })).rejects.toThrow("did not persist its audit event");
    });
});

const REVISION = "2026-07-20T12:00:00.000000Z";

function settingsRow() {
    return {
        email: "dev@example.invalid",
        display_name: "Dev Recruiter",
        revision: REVISION,
    };
}
