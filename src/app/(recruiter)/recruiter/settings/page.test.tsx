import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

const {
    pushMock,
    routerMock,
    getUserMock,
    singleMock,
    upsertMock,
    supabaseClientMock,
} = vi.hoisted(() => {
    const getUserMock = vi.fn();
    const singleMock = vi.fn();
    const upsertMock = vi.fn();

    return {
        pushMock: vi.fn(),
        routerMock: {
            push: vi.fn(),
        },
        getUserMock,
        singleMock,
        upsertMock,
        supabaseClientMock: {
            auth: {
                getUser: getUserMock,
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        single: singleMock,
                    }),
                }),
                upsert: upsertMock,
            }),
        },
    };
});

vi.mock("next/navigation", () => ({
    useRouter: () => routerMock,
}));

routerMock.push = pushMock;

vi.mock("@supabase/ssr", () => ({
    createBrowserClient: () => supabaseClientMock,
}));

describe("SettingsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getUserMock.mockResolvedValue({
            data: { user: { id: "recruiter-1" } },
            error: null,
        });
        singleMock.mockResolvedValue({
            data: {
                first_name: "Pat",
                last_name: "Lee",
                title: "Lead Recruiter",
                phone: "555-111-2222",
                timezone: "America/Chicago",
            },
            error: null,
        });
        upsertMock.mockResolvedValue({ error: null });
    });

    it("loads the recruiter profile and saves updates", async () => {
        const user = userEvent.setup();

        render(<SettingsPage />);

        const titleInput = await screen.findByRole("textbox", { name: /your job title/i });
        expect(titleInput).toHaveValue("Lead Recruiter");

        const firstNameInput = screen.getByRole("textbox", { name: "First Name" });
        const saveButton = screen.getByRole("button", { name: /save changes/i });

        expect(screen.getByText("All changes saved")).toBeInTheDocument();
        expect(saveButton).toBeDisabled();

        await user.clear(firstNameInput);
        await user.type(firstNameInput, "Jordan");

        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
        expect(saveButton).toBeEnabled();

        await user.click(saveButton);

        await waitFor(() => {
            expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
                recruiter_id: "recruiter-1",
                first_name: "Jordan",
                last_name: "Lee",
                title: "Lead Recruiter",
                phone: "555-111-2222",
                timezone: "America/Chicago",
                updated_at: expect.any(String),
            }));
        });

        expect(await screen.findByText("Profile updated successfully.")).toBeInTheDocument();
        expect(screen.getByText("All changes saved")).toBeInTheDocument();
    });

    it("restores the original values when changes are canceled", async () => {
        const user = userEvent.setup();

        render(<SettingsPage />);

        const titleInput = await screen.findByRole("textbox", { name: /your job title/i });

        await user.clear(titleInput);
        await user.type(titleInput, "Director of Talent");
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByRole("textbox", { name: /your job title/i })).toHaveValue("Lead Recruiter");
        expect(screen.getByText("All changes saved")).toBeInTheDocument();
    });
});
