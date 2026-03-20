import * as React from "react"
import { cn } from "@/lib/cn"

export function FieldGroup({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("space-y-3", className)} {...props} />
}

export function FieldLabel({
    className,
    ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
    return (
        <label
            className={cn("text-micro font-bold uppercase tracking-wider text-text-secondary ml-1", className)}
            {...props}
        />
    )
}

export function FieldHint({
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn("text-micro text-text-muted italic ml-1", className)} {...props} />
}

export const textFieldClassName =
    "flex h-12 w-full rounded-xl border border-border bg-surface-subtle px-4 py-2 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-base"

export const textareaFieldClassName =
    "flex min-h-[120px] w-full rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all leading-relaxed"

export const selectFieldClassName =
    "flex h-12 w-full items-center justify-between rounded-xl border border-border bg-surface-subtle px-4 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-base cursor-pointer"

export const choiceCardClassName =
    "w-full rounded-xl border-2 border-transparent bg-muted/50 p-4 text-left transition-all duration-200 hover:bg-muted hover:border-primary/50"

export const largeTextInputClassName =
    "w-full rounded-xl border bg-muted/50 px-4 py-4 text-2xl font-medium tracking-widest outline-none transition-all duration-200 placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground uppercase"

export const answerTextareaClassName =
    "flex-1 w-full resize-none rounded-3xl border border-border bg-surface-base/50 p-6 text-lg font-medium text-text-primary shadow-sm backdrop-blur-sm transition-all placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 md:p-10 md:text-xl min-h-72"
