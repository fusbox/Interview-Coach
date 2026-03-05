import * as React from "react"
import { cn } from "@/lib/cn"

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    title: string | React.ReactNode
    description?: string | React.ReactNode
    actions?: React.ReactNode
    size?: "sm" | "md" | "lg"
}

export function SectionHeader({
    title,
    description,
    actions,
    size = "md",
    className,
    ...props
}: SectionHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
                className
            )}
            {...props}
        >
            <div className="space-y-1">
                <h2
                    className={cn(
                        "font-semibold text-text-primary tracking-tight",
                        {
                            "text-lg": size === "sm",
                            "text-xl": size === "md",
                            "text-2xl font-display": size === "lg",
                        }
                    )}
                >
                    {title}
                </h2>
                {description && (
                    <div className={cn(
                        "text-text-muted",
                        {
                            "text-sm": size === "sm",
                            "text-sm sm:text-base": size === "md",
                            "text-base": size === "lg",
                        }
                    )}>
                        {description}
                    </div>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-3 shrink-0">
                    {actions}
                </div>
            )}
        </div>
    )
}
