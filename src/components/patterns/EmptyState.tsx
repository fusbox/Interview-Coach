import * as React from "react"
import { SectionHeader } from "./SectionHeader"
import { cn } from "@/lib/cn"
import { Inbox } from "lucide-react"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string
    description?: string
    icon?: React.ReactNode
    actions?: React.ReactNode
    border?: boolean
}

export function EmptyState({
    title,
    description,
    icon = <Inbox size={48} className="text-muted-foreground/30" />,
    actions,
    border = true,
    className,
    ...props
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center py-16 px-6",
                border && "border border-dashed rounded-2xl bg-surface-subtle/50",
                className
            )}
            {...props}
        >
            <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-surface-base border shadow-flat">
                {icon}
            </div>
            <SectionHeader
                title={title}
                description={description}
                size="md"
                className="items-center text-center max-w-md mx-auto"
            />
            {actions && <div className="mt-8 flex items-center gap-3">{actions}</div>}
        </div>
    )
}
