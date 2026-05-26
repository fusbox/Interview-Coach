import { createElement, type ComponentProps, type ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateMobileDock } from "./CandidateMobileDock";
import { CandidateSidebar } from "./CandidateSidebar";

const { usePathnameMock, useMotionValueEventMock } = vi.hoisted(() => ({
    usePathnameMock: vi.fn(),
    useMotionValueEventMock: vi.fn(),
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
        nav: ({ children, animate, transition, variants, ...props }: ComponentProps<"nav"> & {
            animate?: unknown;
            transition?: unknown;
            variants?: unknown;
        }) => {
            void animate;
            void transition;
            void variants;
            return <nav {...props}>{children}</nav>;
        },
    },
    useMotionValueEvent: useMotionValueEventMock,
    useScroll: () => ({
        scrollY: {
            getPrevious: () => 0,
        },
    }),
}));

describe("candidate navigation shell", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        usePathnameMock.mockReturnValue("/practice");
    });

    it("renders the candidate sidebar with only create practice and dashboard navigation", () => {
        render(<CandidateSidebar />);

        expect(screen.getByRole("link", { name: /talentarbor/i })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: /create practice/i })).toHaveAttribute("href", "/practice");
        expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
        expect(screen.queryByText(/quick actions/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/navigation/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
    });

    it("renders the mobile dock as the same two candidate navigation targets", () => {
        render(<CandidateMobileDock />);

        const links = screen.getAllByRole("link");

        expect(links).toHaveLength(2);
        expect(screen.getByRole("link", { name: /create practice/i })).toHaveAttribute("href", "/practice");
        expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
    });
});
