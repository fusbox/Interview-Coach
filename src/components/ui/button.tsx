import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap transition-all duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-raised-1 hover:shadow-raised-2",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-raised-1 hover:shadow-raised-2",
                outline:
                    "border border-input bg-background hover:bg-surface-subtle hover:text-accent-foreground shadow-flat hover:shadow-raised-1",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
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
    }
)

const buttonSystemClasses = {
    emphasis: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-raised-1 hover:shadow-raised-2",
        secondary: "border border-input bg-background text-text-primary hover:bg-surface-subtle shadow-flat hover:shadow-raised-1",
        tertiary: "bg-transparent text-primary hover:bg-primary/5 hover:text-primary shadow-none",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-raised-1 hover:shadow-raised-2",
        link: "bg-transparent text-primary underline-offset-4 hover:underline shadow-none",
        info: "bg-state-info text-primary-foreground hover:bg-state-info/90 shadow-raised-1 hover:shadow-raised-2",
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
} as const

type ButtonEmphasis = keyof typeof buttonSystemClasses.emphasis
type ButtonDensity = keyof typeof buttonSystemClasses.density
type ButtonShape = keyof typeof buttonSystemClasses.shape
type ButtonLabel = keyof typeof buttonSystemClasses.label

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
    emphasis?: ButtonEmphasis
    density?: ButtonDensity
    shape?: ButtonShape
    label?: ButtonLabel
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, emphasis, density, shape, label, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        const resolvedVariant = emphasis ? undefined : (variant ?? "default")
        const resolvedSize = density ? undefined : (size ?? "default")

        return (
            <Comp
                className={cn(
                    buttonVariants({ variant: resolvedVariant, size: resolvedSize }),
                    emphasis && buttonSystemClasses.emphasis[emphasis],
                    density && buttonSystemClasses.density[density],
                    shape && buttonSystemClasses.shape[shape],
                    label && buttonSystemClasses.label[label],
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonSystemClasses, buttonVariants }
