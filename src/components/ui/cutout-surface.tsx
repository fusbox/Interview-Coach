"use client";

import * as React from "react";

import { cn } from "@/lib/cn";
import type { SurfaceState } from "./surface";

export type CutoutPlacement = "top-end" | "bottom-start";
export type CutoutSurfaceTone = "question" | "composer";

export type CutoutGeometry = {
    height: number;
    notchDepth: number;
    notchRadius: number;
    notchWidth: number;
    outerRadius: number;
    width: number;
};

export const DEFAULT_CUTOUT_GEOMETRY: CutoutGeometry = {
    height: 240,
    notchDepth: 44,
    notchRadius: 16,
    notchWidth: 92,
    outerRadius: 24,
    width: 320,
};

type MeasuredCutoutGeometry = CutoutGeometry & {
    direction: "ltr" | "rtl";
};

export type CutoutSurfaceProps = Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "children"
> & {
    children: React.ReactNode;
    cutout?: CutoutPlacement;
    notch?: React.ReactNode;
    notchLabel?: string;
    state?: SurfaceState;
    tone?: CutoutSurfaceTone;
};

function formatPathNumber(value: number) {
    return Number(value.toFixed(3));
}

export function createCutoutPath(geometry: CutoutGeometry) {
    const width = Math.max(geometry.width, 1);
    const height = Math.max(geometry.height, 1);
    const requestedOuterRadius = Math.max(geometry.outerRadius, 0);
    const requestedNotchDepth = Math.max(geometry.notchDepth, 0);
    const requestedNotchRadius = Math.max(geometry.notchRadius, 0);
    const requestedNotchWidth = Math.max(geometry.notchWidth, 0);
    const scale = Math.min(
        1,
        width / Math.max(requestedNotchWidth + requestedOuterRadius * 2, 1),
        height / Math.max(requestedNotchDepth + requestedOuterRadius * 2, 1),
    );
    const outerRadius = formatPathNumber(requestedOuterRadius * scale);
    const notchDepth = formatPathNumber(requestedNotchDepth * scale);
    const notchRadius = formatPathNumber(requestedNotchRadius * scale);
    const notchWidth = formatPathNumber(requestedNotchWidth * scale);
    const notchStart = formatPathNumber(width - notchWidth);

    return [
        `M ${outerRadius} 0`,
        `L ${formatPathNumber(notchStart - notchRadius)} 0`,
        `A ${notchRadius} ${notchRadius} 0 0 1 ${notchStart} ${notchRadius}`,
        `L ${notchStart} ${formatPathNumber(notchDepth - notchRadius)}`,
        `A ${notchRadius} ${notchRadius} 0 0 0 ${formatPathNumber(notchStart + notchRadius)} ${notchDepth}`,
        `L ${formatPathNumber(width - outerRadius)} ${notchDepth}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${width} ${formatPathNumber(notchDepth + outerRadius)}`,
        `L ${width} ${formatPathNumber(height - outerRadius)}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${formatPathNumber(width - outerRadius)} ${height}`,
        `L ${outerRadius} ${height}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 0 ${formatPathNumber(height - outerRadius)}`,
        `L 0 ${outerRadius}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${outerRadius} 0`,
        "Z",
    ].join(" ");
}

export function getCutoutTransform(
    cutout: CutoutPlacement,
    direction: "ltr" | "rtl",
    width: number,
    height: number,
) {
    if (cutout === "top-end") {
        return direction === "rtl"
            ? `translate(${width} 0) scale(-1 1)`
            : undefined;
    }

    return direction === "rtl"
        ? `translate(0 ${height}) scale(1 -1)`
        : `translate(${width} ${height}) rotate(180)`;
}

function readTokenLength(
    element: HTMLElement,
    token: string,
    fallback: number,
) {
    const probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.position = "absolute";
    probe.style.width = `var(${token})`;
    probe.style.height = "0";
    probe.style.overflow = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.visibility = "hidden";
    element.appendChild(probe);
    const value = Number.parseFloat(window.getComputedStyle(probe).width);
    probe.remove();
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function useCutoutGeometry(rootRef: React.RefObject<HTMLDivElement | null>) {
    const [geometry, setGeometry] = React.useState<MeasuredCutoutGeometry>({
        ...DEFAULT_CUTOUT_GEOMETRY,
        direction: "ltr",
    });

    React.useLayoutEffect(() => {
        const element = rootRef.current;
        if (!element) return undefined;

        const tokenGeometry = {
            notchDepth: readTokenLength(
                element,
                "--cutout-notch-depth",
                DEFAULT_CUTOUT_GEOMETRY.notchDepth,
            ),
            notchRadius: readTokenLength(
                element,
                "--cutout-notch-radius",
                DEFAULT_CUTOUT_GEOMETRY.notchRadius,
            ),
            notchWidth: readTokenLength(
                element,
                "--cutout-notch-width",
                DEFAULT_CUTOUT_GEOMETRY.notchWidth,
            ),
            outerRadius: readTokenLength(
                element,
                "--cutout-surface-radius",
                DEFAULT_CUTOUT_GEOMETRY.outerRadius,
            ),
        };

        const updateGeometry = (rect?: Pick<DOMRectReadOnly, "height" | "width">) => {
            const bounds = rect ?? element.getBoundingClientRect();
            const nextGeometry: MeasuredCutoutGeometry = {
                ...tokenGeometry,
                direction: window.getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr",
                height:
                    bounds.height ||
                    element.offsetHeight ||
                    DEFAULT_CUTOUT_GEOMETRY.height,
                width:
                    bounds.width ||
                    element.offsetWidth ||
                    DEFAULT_CUTOUT_GEOMETRY.width,
            };

            setGeometry((current) => {
                const unchanged = Object.keys(nextGeometry).every(
                    (key) =>
                        current[key as keyof MeasuredCutoutGeometry] ===
                        nextGeometry[key as keyof MeasuredCutoutGeometry],
                );
                return unchanged ? current : nextGeometry;
            });
        };

        updateGeometry();

        if (!window.ResizeObserver) {
            const handleWindowResize = () => updateGeometry();
            window.addEventListener("resize", handleWindowResize);
            return () => window.removeEventListener("resize", handleWindowResize);
        }

        const observer = new window.ResizeObserver((entries) => {
            updateGeometry(entries[0]?.contentRect);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [rootRef]);

    return geometry;
}

export const CutoutSurface = React.forwardRef<
    HTMLDivElement,
    CutoutSurfaceProps
>(
    (
        {
            children,
            className,
            cutout = "top-end",
            notch,
            notchLabel,
            state = "default",
            tone = "question",
            ...props
        },
        forwardedRef,
    ) => {
        const rootRef = React.useRef<HTMLDivElement | null>(null);
        const gradientId = React.useId().replaceAll(":", "");
        const rimGradientId = `${gradientId}-rim`;
        const geometry = useCutoutGeometry(rootRef);
        const path = createCutoutPath(geometry);
        const transform = getCutoutTransform(
            cutout,
            geometry.direction,
            geometry.width,
            geometry.height,
        );
        const setRootRef = React.useCallback(
            (node: HTMLDivElement | null) => {
                rootRef.current = node;
                if (typeof forwardedRef === "function") {
                    forwardedRef(node);
                } else if (forwardedRef) {
                    (
                        forwardedRef as React.MutableRefObject<HTMLDivElement | null>
                    ).current = node;
                }
            },
            [forwardedRef],
        );
        const notchStyle: React.CSSProperties =
            cutout === "top-end"
                ? geometry.direction === "rtl"
                    ? { top: "var(--cutout-control-offset)", right: "auto", left: "var(--space-2)" }
                    : { top: "var(--cutout-control-offset)", right: "var(--space-2)", left: "auto" }
                : geometry.direction === "rtl"
                  ? { bottom: "var(--cutout-control-offset)", right: "var(--space-2)", left: "auto" }
                  : { bottom: "var(--cutout-control-offset)", right: "auto", left: "var(--space-2)" };

        return (
            <div
                ref={setRootRef}
                className={cn("ui-surface ui-cutout-surface", className)}
                {...props}
                aria-busy={state === "loading" || undefined}
                data-cutout={cutout}
                data-direction={geometry.direction}
                data-state={state}
                data-tone={tone}
            >
                <div
                    className="ui-cutout-surface__recess"
                    aria-hidden="true"
                />
                <div
                    className="ui-cutout-surface__contour"
                    aria-hidden="true"
                />
                <svg
                    className="ui-cutout-surface__shape"
                    viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                >
                    <defs>
                        <linearGradient
                            id={gradientId}
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                        >
                            <stop
                                className="ui-cutout-surface__stop-start"
                                offset="0%"
                            />
                            <stop
                                className="ui-cutout-surface__stop-end"
                                offset="100%"
                            />
                        </linearGradient>
                        <linearGradient
                            id={rimGradientId}
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                        >
                            <stop
                                className="ui-cutout-surface__rim-stop-start"
                                offset="0%"
                            />
                            <stop
                                className="ui-cutout-surface__rim-stop-middle"
                                offset="54%"
                            />
                            <stop
                                className="ui-cutout-surface__rim-stop-end"
                                offset="100%"
                            />
                        </linearGradient>
                    </defs>
                    <g transform={transform}>
                        <path
                            className="ui-cutout-surface__rim"
                            d={path}
                            fill="none"
                            stroke={
                                tone === "question" && state === "default"
                                    ? `url(#${rimGradientId})`
                                    : "none"
                            }
                        />
                        <path
                            className="ui-cutout-surface__path"
                            d={path}
                            fill={`url(#${gradientId})`}
                        />
                    </g>
                </svg>
                <div className="ui-cutout-surface__content">{children}</div>
                {notch ? (
                    <div
                        className="ui-cutout-surface__notch"
                        style={notchStyle}
                        role={notchLabel ? "group" : undefined}
                        aria-label={notchLabel}
                    >
                        {notch}
                    </div>
                ) : null}
            </div>
        );
    },
);

CutoutSurface.displayName = "CutoutSurface";
