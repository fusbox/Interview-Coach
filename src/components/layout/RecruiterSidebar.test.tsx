import { createElement, type ComponentProps, type ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecruiterSidebar } from "./RecruiterSidebar";

const { usePathnameMock } = vi.hoisted(() => ({
    usePathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: usePathnameMock,
}));

vi.mock("next/image", () => ({
    default: ({ fill, priority, unoptimized, ...props }: ComponentProps<"img"> & {
        fill?: boolean;
        priority?: boolean;
        unoptimized?: boolean;
    }) => {
        void fill;
        void priority;
        void unoptimized;
        return createElement("img", props);
    },
}));

vi.mock("framer-motion", () => ({
    motion: {
        div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
}));

vi.mock("@/components/auth/LogoutButton", () => ({
    LogoutButton: () => <button type="button">Mock logout</button>,
}));

describe("RecruiterSidebar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        usePathnameMock.mockReturnValue("/recruiter/dashboard");
    });

    it("routes Invites & Sessions to the recruiter dashboard", () => {
        render(<RecruiterSidebar />);

        expect(screen.getByRole("link", { name: /invites & sessions/i })).toHaveAttribute(
            "href",
            "/recruiter/dashboard",
        );
    });
});
