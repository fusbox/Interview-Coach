import * as React from "react";

import { cn } from "@/lib/cn";

export type SurfaceProminence =
    | "calm"
    | "feature-tint"
    | "feature-dark"
    | "glass-raised"
    | "glass-quiet"
    | "spotlight";

export type SurfaceState =
    | "default"
    | "selected"
    | "success"
    | "warning"
    | "critical"
    | "loading"
    | "disabled";

const surfaceProminenceClasses: Record<SurfaceProminence, string> = {
    calm: "surface-calm",
    "feature-tint": "surface-feature-tint",
    "feature-dark": "surface-feature-dark",
    "glass-raised": "surface-glass-raised",
    "glass-quiet": "surface-glass-quiet",
    spotlight: "surface-spotlight",
};

type SurfaceBaseProps = {
    children?: React.ReactNode;
    className?: string;
    prominence?: SurfaceProminence;
    state?: SurfaceState;
};

type StaticSurfaceProps = SurfaceBaseProps &
    Omit<React.HTMLAttributes<HTMLElement>, "children" | "className" | "onClick"> & {
        as?: "article" | "div" | "section";
        onClick?: never;
    };

type ButtonSurfaceProps = SurfaceBaseProps &
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
        as: "button";
    };

type LinkSurfaceProps = Omit<SurfaceBaseProps, "state"> &
    Omit<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        "aria-disabled" | "children" | "className" | "href"
    > & {
        as: "a";
        disabled?: never;
        href: string;
        state?: Exclude<SurfaceState, "disabled" | "loading">;
        "aria-disabled"?: never;
    };

export type SurfaceProps =
    | StaticSurfaceProps
    | ButtonSurfaceProps
    | LinkSurfaceProps;

function surfaceClasses(
    prominence: SurfaceProminence,
    className?: string,
) {
    return cn("ui-surface", surfaceProminenceClasses[prominence], className);
}

export const Surface = React.forwardRef<
    HTMLAnchorElement | HTMLButtonElement | HTMLElement,
    SurfaceProps
>((props, ref) => {
    if (props.as === "button") {
        const {
            as: ButtonElement,
            children,
            className,
            disabled,
            prominence = "calm",
            state = "default",
            type = "button",
            ...buttonProps
        } = props;
        const isUnavailable = disabled || state === "disabled" || state === "loading";

        return (
            <ButtonElement
                ref={ref as React.ForwardedRef<HTMLButtonElement>}
                className={surfaceClasses(prominence, className)}
                {...buttonProps}
                type={type}
                disabled={isUnavailable}
                aria-busy={state === "loading" || undefined}
                data-interactive="true"
                data-state={state}
            >
                {children}
            </ButtonElement>
        );
    }

    if (props.as === "a") {
        const {
            as: LinkElement,
            children,
            className,
            href,
            prominence = "calm",
            state = "default",
            ...anchorProps
        } = props;

        return (
            <LinkElement
                ref={ref as React.ForwardedRef<HTMLAnchorElement>}
                className={surfaceClasses(prominence, className)}
                href={href}
                {...anchorProps}
                data-interactive="true"
                data-state={state}
            >
                {children}
            </LinkElement>
        );
    }

    const {
        as: Element = "div",
        children,
        className,
        prominence = "calm",
        state = "default",
        ...elementProps
    } = props;

    return (
        <Element
            ref={ref as React.ForwardedRef<HTMLDivElement>}
            className={surfaceClasses(prominence, className)}
            {...elementProps}
            aria-busy={state === "loading" || undefined}
            data-state={state}
        >
            {children}
        </Element>
    );
});

Surface.displayName = "Surface";

export { surfaceProminenceClasses };
