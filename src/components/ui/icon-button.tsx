import * as React from "react";

import { Button, type NativeButtonProps } from "./button";
import { cn } from "@/lib/cn";

export type IconButtonTone =
    | "neutral"
    | "primary"
    | "accent"
    | "danger";

export type IconButtonSize = "compact" | "default" | "comfortable";

export type IconButtonProps = Omit<
    NativeButtonProps,
    | "aria-label"
    | "aria-pressed"
    | "children"
    | "density"
    | "emphasis"
    | "label"
    | "shape"
    | "size"
    | "variant"
> & {
    children: React.ReactElement;
    label: string;
    pressed?: boolean;
    size?: IconButtonSize;
    tone?: IconButtonTone;
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    (
        {
            children,
            className,
            label,
            pressed,
            size = "default",
            tone = "neutral",
            ...props
        },
        ref,
    ) => {
        const stateAttributes = {
            "aria-pressed": pressed,
            "data-size": size,
            "data-tone": tone,
        };

        return (
            <Button
                ref={ref}
                className={cn("ui-icon-button", className)}
                emphasis="tertiary"
                shape="pill"
                size="icon"
                aria-label={label}
                {...stateAttributes}
                {...props}
            >
                {children}
            </Button>
        );
    },
);

IconButton.displayName = "IconButton";
