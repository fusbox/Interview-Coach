import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
    "ui-button inline-flex items-center justify-center whitespace-nowrap disabled:pointer-events-none",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-raised-1 hover:shadow-raised-2",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-raised-1 hover:shadow-raised-2",
                outline:
                    "border border-input bg-background hover:bg-surface-subtle hover:text-accent-foreground shadow-flat hover:shadow-raised-1",
                secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-surface-subtle hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                info: "bg-state-info text-primary-foreground hover:bg-state-info/90 shadow-raised-1 hover:shadow-raised-2",
            },
            size: {
                default: "h-10 rounded-md px-4 py-2 text-sm font-medium",
                sm: "h-9 rounded-md px-3 text-sm font-medium",
                lg: "h-11 rounded-md px-8 text-sm font-medium",
                icon: "h-10 w-10 rounded-md text-sm font-medium",
            },
        },
    },
);

const buttonSystemClasses = {
    emphasis: {
        primary: "ui-button--primary",
        secondary: "ui-button--secondary",
        tertiary: "ui-button--tertiary",
        danger: "ui-button--danger",
        link: "ui-button--link",
        info: "ui-button--info",
    },
    density: {
        compact: "h-9 px-3 text-sm",
        default: "h-10 px-4 py-2 text-sm",
        comfortable: "h-11 px-6 text-sm",
        hero: "h-12 px-8 text-base",
    },
    shape: {
        app: "rounded-2xl",
        pill: "rounded-full",
        square: "rounded-xl",
    },
    label: {
        default: "font-medium normal-case tracking-normal",
        strong: "font-semibold normal-case tracking-normal",
        chrome: "font-bold uppercase text-micro tracking-widest",
    },
} as const;

type ButtonEmphasis = keyof typeof buttonSystemClasses.emphasis;
type ButtonDensity = keyof typeof buttonSystemClasses.density;
type ButtonShape = keyof typeof buttonSystemClasses.shape;
type ButtonLabel = keyof typeof buttonSystemClasses.label;

type ButtonStyleProps = VariantProps<typeof buttonVariants> & {
    emphasis?: ButtonEmphasis;
    density?: ButtonDensity;
    shape?: ButtonShape;
    label?: ButtonLabel;
};

export type NativeButtonProps = Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "children"
> &
    ButtonStyleProps & {
        children: React.ReactNode;
        href?: never;
        loading?: boolean;
    };

export type LinkButtonProps = Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "aria-disabled" | "children" | "href"
> &
    ButtonStyleProps & {
        children: React.ReactNode;
        disabled?: never;
        href: string;
        loading?: never;
        type?: never;
        "aria-disabled"?: never;
    };

export type ButtonProps = NativeButtonProps | LinkButtonProps;

function resolveButtonClasses({
    className,
    density,
    emphasis,
    label,
    shape,
    size,
    variant,
}: ButtonStyleProps & { className?: string }) {
    const resolvedVariant = emphasis ? undefined : (variant ?? "default");
    const resolvedSize = density ? undefined : (size ?? "default");

    return cn(
        buttonVariants({ variant: resolvedVariant, size: resolvedSize }),
        emphasis && buttonSystemClasses.emphasis[emphasis],
        density && buttonSystemClasses.density[density],
        shape && buttonSystemClasses.shape[shape],
        label && buttonSystemClasses.label[label],
        className,
    );
}

const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
    (props, ref) => {
        if ("href" in props && typeof props.href === "string") {
            const {
                children,
                className,
                density,
                emphasis,
                href,
                label,
                shape,
                size,
                variant,
                ...anchorProps
            } = props;

            return (
                <a
                    ref={ref as React.ForwardedRef<HTMLAnchorElement>}
                    className={resolveButtonClasses({
                        className,
                        density,
                        emphasis,
                        label,
                        shape,
                        size,
                        variant,
                    })}
                    href={href}
                    {...anchorProps}
                >
                    <span className="ui-button__content">{children}</span>
                </a>
            );
        }

        const {
            children,
            className,
            density,
            disabled,
            emphasis,
            label,
            loading = false,
            shape,
            size,
            type = "button",
            variant,
            ...buttonProps
        } = props;

        return (
            <button
                ref={ref as React.ForwardedRef<HTMLButtonElement>}
                className={resolveButtonClasses({
                    className,
                    density,
                    emphasis,
                    label,
                    shape,
                    size,
                    variant,
                })}
                {...buttonProps}
                type={type}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                data-state={loading ? "loading" : undefined}
            >
                <span className="ui-button__content">{children}</span>
                {loading ? <Loader2 className="ui-button__spinner" aria-hidden="true" /> : null}
            </button>
        );
    },
);
Button.displayName = "Button";

export { Button, buttonSystemClasses, buttonVariants };
