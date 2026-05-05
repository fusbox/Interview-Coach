import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

const {
    pushMock,
    routerMock,
    fetchMock,
} = vi.hoisted(() => {
    return {
        pushMock: vi.fn(),
        routerMock: {
            push: vi.fn(),
        },
        fetchMock: vi.fn(),
    };
});

vi.mock("next/navigation", () => ({
    useRouter: () => routerMock,
}));

routerMock.push = pushMock;

function createJsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json",
        },
    });
}

function createProfileBody(overrides: Record<string, unknown> = {}) {
    return {
        user: {
            id: "recruiter-1",
            email: "recruiter@example.com",
        },
        profileExists: true,
        profile: {
            recruiter_id: "recruiter-1",
            first_name: "Pat",
            last_name: "Lee",
            title: "Lead Recruiter",
            phone: "(555) 111-2222",
            timezone: "America/Chicago",
            ...overrides,
        },
    };
}

describe("SettingsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockResolvedValueOnce(createJsonResponse(createProfileBody()));
    });

    it("loads the recruiter profile and saves updates", async () => {
        const user = userEvent.setup();

        render(<SettingsPage />);

        const titleInput = await screen.findByRole("textbox", { name: /your job title/i });
        expect(titleInput).toHaveValue("Lead Recruiter");

        const firstNameInput = screen.getByRole("textbox", { name: "First Name" });
        const savedButton = screen.getByRole("button", { name: /saved/i });

        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
        expect(savedButton).toBeDisabled();

        await user.clear(firstNameInput);
        await user.type(firstNameInput, "Jordan");

        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
        const saveButton = screen.getByRole("button", { name: /save changes/i });
        expect(saveButton).toBeEnabled();

        fetchMock.mockResolvedValueOnce(createJsonResponse({
            success: true,
            profile: {
                recruiter_id: "recruiter-1",
                first_name: "Jordan",
                last_name: "Lee",
                title: "Lead Recruiter",
                phone: "(555) 111-2222",
                timezone: "America/Chicago",
            },
        }));

        await user.click(saveButton);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith("/api/recruiter/profile", expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    first_name: "Jordan",
                    last_name: "Lee",
                    title: "Lead Recruiter",
                    phone: "(555) 111-2222",
                    timezone: "America/Chicago",
                }),
            }));
        });

        expect(await screen.findByText("Profile updated successfully.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /saved/i })).toBeDisabled();
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });

    it("restores the original values when changes are canceled", async () => {
        const user = userEvent.setup();

        render(<SettingsPage />);

        const titleInput = await screen.findByRole("textbox", { name: /your job title/i });

        await user.clear(titleInput);
        await user.type(titleInput, "Director of Talent");
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByRole("textbox", { name: /your job title/i })).toHaveValue("Lead Recruiter");
        expect(screen.getByRole("button", { name: /saved/i })).toBeDisabled();
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });
});
