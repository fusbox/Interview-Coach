import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecruiterLogoutButton } from "./RecruiterLogoutButton";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("RecruiterLogoutButton", () => {
    it("uses a full-document replacement after durable logout succeeds", async () => {
        const user = userEvent.setup();
        const navigate = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
        }));
        vi.stubGlobal("fetch", fetchMock);
        render(<RecruiterLogoutButton navigate={navigate} />);

        const signOutButton = screen.getByRole("button", { name: "Sign out" });
        expect(signOutButton).toHaveClass("rounded-full");
        await user.click(signOutButton);

        await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login"));
        expect(screen.getByRole("button", { name: "Signing out" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Signing out" })).toHaveAttribute("aria-busy", "true");
        expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
        });
    });

    it("stays on the current page when durable logout fails", async () => {
        const user = userEvent.setup();
        const navigate = vi.fn();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
        render(<RecruiterLogoutButton navigate={navigate} />);

        await user.click(screen.getByRole("button", { name: "Sign out" }));

        await waitFor(() => expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled());
        expect(screen.getByRole("button", { name: "Sign out" })).not.toHaveAttribute("aria-busy");
        expect(navigate).not.toHaveBeenCalled();
    });
});
