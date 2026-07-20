import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderRecruiterSettingsRoute } from "./RecruiterSettingsRoute";

const { redirectMock, refreshMock } = vi.hoisted(() => ({
    redirectMock: vi.fn((target: string) => {
        throw new Error(`redirect:${target}`);
    }),
    refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    redirect: redirectMock,
    useRouter: () => ({ refresh: refreshMock }),
}));

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe("recruiter settings page", () => {
    it("loads only the authenticated recruiter's settings", async () => {
        const loadSettings = vi.fn().mockResolvedValue(settings());
        render(await renderRecruiterSettingsRoute({ resolveAccess: authorizedAccess, loadSettings }));

        expect(loadSettings).toHaveBeenCalledWith("user-1");
        expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Dev Recruiter");
        expect(screen.getByText("dev@example.invalid")).toBeInTheDocument();
        expect(screen.getByText("dev@example.invalid").closest("div")).not.toContainHTML("input");
        expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    });

    it("normalizes and saves the candidate-facing name, then refreshes the shell", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            status: "settings_saved",
            outcome: "updated",
            settings: { ...settings(), senderDisplayName: "Fu Chen", revision: "2026-07-20T12:01:00.000000Z" },
        }), { status: 200, headers: { "content-type": "application/json" } }));
        vi.stubGlobal("fetch", fetchMock);
        render(await renderRecruiterSettingsRoute({
            resolveAccess: authorizedAccess,
            loadSettings: async () => settings(),
        }));

        const input = screen.getByRole("textbox", { name: "Display name" });
        await user.clear(input);
        await user.type(input, "  Fu   Chen  ");
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() => expect(screen.getByText("Settings saved")).toBeInTheDocument());
        expect(fetchMock).toHaveBeenCalledWith("/api/recruiter/profile", expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ senderDisplayName: "Fu Chen", revision: settings().revision }),
        }));
        expect(input).toHaveValue("Fu Chen");
        expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it("keeps the edited name when persistence fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: "Settings could not be saved. Try again.",
        }), { status: 503, headers: { "content-type": "application/json" } })));
        render(await renderRecruiterSettingsRoute({
            resolveAccess: authorizedAccess,
            loadSettings: async () => settings(),
        }));
        const input = screen.getByRole("textbox", { name: "Display name" });
        fireEvent.change(input, { target: { value: "Unsaved Name" } });
        fireEvent.submit(input.closest("form")!);

        await waitFor(() => expect(screen.getByText("Settings could not be saved. Try again.")).toBeInTheDocument());
        expect(input).toHaveValue("Unsaved Name");
        expect(refreshMock).not.toHaveBeenCalled();
    });

    it("does not load settings without recruiter access", async () => {
        const loadSettings = vi.fn();
        render(await renderRecruiterSettingsRoute({
            resolveAccess: async () => ({ kind: "forbidden", user: { ...authorizedAccessUser(), roles: ["qa"] } }),
            loadSettings,
        }));
        expect(loadSettings).not.toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: "This account does not have recruiter access." })).toBeInTheDocument();
    });

    it("redirects missing authentication to the exact settings return target", async () => {
        const loadSettings = vi.fn();
        await expect(renderRecruiterSettingsRoute({
            resolveAccess: async () => ({ kind: "missing" }),
            loadSettings,
        })).rejects.toThrow("redirect:/login?next=%2Frecruiter%2Fsettings");
        expect(loadSettings).not.toHaveBeenCalled();
    });
});

const REVISION = "2026-07-20T12:00:00.000000Z";

async function authorizedAccess() {
    return { kind: "authorized" as const, user: authorizedAccessUser() };
}

function authorizedAccessUser() {
    return {
        id: "user-1",
        email: "dev@example.invalid",
        displayName: "Dev Recruiter",
        status: "active" as const,
        roles: ["recruiter" as const],
    };
}

function settings() {
    return { senderDisplayName: "Dev Recruiter", email: "dev@example.invalid", revision: REVISION };
}
