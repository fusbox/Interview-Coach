import * as React from "react"
import { cn } from "@/lib/cn"

export interface SessionPromptShellProps extends React.HTMLAttributes<HTMLDivElement> {
    footer?: React.ReactNode
}

export function SessionPromptShell({
    children,
    footer,
    className,
    ...props
}: SessionPromptShellProps) {
    return (
        <div
            className={cn(
                "glass-card relative w-full overflow-hidden rounded-3xl p-6 text-text-primary ring-1 ring-border/50 transition-all duration-300 md:p-10",
                className
            )}
            {...props}
        >
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-deep/20 to-brand-deep" />
            <div>{children}</div>
            {footer && (
                <div className="-mx-6 -mb-6 mt-6 border-t-2 border-border/50 bg-surface-platinum/5 px-6 pb-4 pt-4 shadow-flat md:-mx-10 md:-mb-10 md:mt-8 md:px-10 md:pb-10 md:pt-6">
                    {footer}
                </div>
            )}
        </div>
    )
}
