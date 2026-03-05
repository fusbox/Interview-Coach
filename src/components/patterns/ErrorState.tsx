import * as React from "react"
import { SectionHeader } from "./SectionHeader"
import { cn } from "@/lib/cn"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string
    description?: string
    icon?: React.ReactNode
    onRetry?: () => void
    error?: Error | string
}

export function ErrorState({
    title = "Something went wrong",
    description = "We encountered an error while loading this content. Please try again or contact support if the issue persists.",
    icon = <AlertCircle size={48} className="text-state-critical/50" />,
    onRetry,
    error,
    className,
    ...props
}: ErrorStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center py-16 px-6 border border-state-critical/10 rounded-2xl bg-state-critical/5",
                className
            )}
            {...props}
        >
            <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-surface-base border border-state-critical/20 shadow-raised-1">
                {icon}
            </div>
            <SectionHeader
                title={title}
                description={description}
                size="md"
                className="items-center text-center max-w-md mx-auto"
            />

            {error && (
                <div className="mt-6 p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-border/50 max-w-lg overflow-auto">
                    <code className="text-micro text-muted-foreground whitespace-pre-wrap">
                        {typeof error === 'string' ? error : error.message}
                    </code>
                </div>
            )}

            {onRetry && (
                <div className="mt-8">
                    <Button onClick={onRetry} variant="outline" className="gap-2">
                        <RefreshCw size={16} />
                        Try Again
                    </Button>
                </div>
            )}
        </div>
    )
}
