import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecruiterMobileDock } from "./RecruiterMobileDock";

const { usePathnameMock, useRouterRefreshMock, useRouterPushMock, useMotionValueEventMock } = vi.hoisted(() => ({
    usePathnameMock: vi.fn(),
    useRouterRefreshMock: vi.fn(),
    useRouterPushMock: vi.fn(),
    useMotionValueEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: usePathnameMock,
    useRouter: () => ({
        refresh: useRouterRefreshMock,
        push: useRouterPushMock,
    }),
}));

vi.mock("framer-motion", () => ({
    motion: {
        div: ({ children, animate, transition, variants, ...props }: React.HTMLAttributes<HTMLDivElement> & {
            animate?: unknown;
            transition?: unknown;
            variants?: unknown;
            children: ReactNode;
        }) => {
            void animate;
            void transition;
            void variants;
            return <div {...props}>{children}</div>;
        },
    },
    useMotionValueEvent: useMotionValueEventMock,
    useScroll: () => ({
        scrollY: {
            getPrevious: () => 0,
        },
    }),
}));

describe("RecruiterMobileDock", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        usePathnameMock.mockReturnValue("/recruiter/dashboard");
    });

    it("routes Invites & Sessions to the recruiter dashboard", () => {
        render(<RecruiterMobileDock />);

        expect(screen.getByRole("link", { name: /invites & sessions/i })).toHaveAttribute(
            "href",
            "/recruiter/dashboard",
        );
    });
});
