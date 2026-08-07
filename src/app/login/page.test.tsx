import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        replace: vi.fn(),
        refresh: vi.fn(),
    }),
}));

describe("recruiter login page", () => {
    it("uses the shared branded account shell without a registration action", async () => {
        render(await LoginPage({
            searchParams: Promise.resolve({ next: "/recruiter/dashboard" }),
        }));

        expect(screen.getByRole("banner", { name: /Interview Coach/ })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
        expect(screen.getByRole("navigation", { name: "Account policies" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument();
    });
});
