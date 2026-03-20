import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

export const EMOJI_SCALE = [
    { val: 1, emoji: "🙁" },
    { val: 2, emoji: "😐" },
    { val: 3, emoji: "🙂" },
    { val: 4, emoji: "😊" },
    { val: 5, emoji: "🤩" },
] as const

const feedbackChoiceVariants = cva(
    "border-2 transition-all duration-300 flex items-center justify-center",
    {
        variants: {
            kind: {
                emoji: "h-14 w-14 rounded-2xl text-3xl",
                chip: "gap-2 rounded-2xl px-8 py-4 font-bold",
                compact: "gap-2 rounded-xl px-4 py-2 text-sm font-bold",
            },
            selected: {
                true: "scale-105 shadow-lg",
                false: "",
            },
            tone: {
                primary: "",
                success: "",
                neutral: "",
            },
        },
        compoundVariants: [
            {
                kind: "emoji",
                selected: true,
                tone: "primary",
                className: "bg-white dark:bg-blue-900/20 border-primary/50 saturate-100 opacity-100 scale-110",
            },
            {
                kind: "emoji",
                selected: false,
                tone: "primary",
                className: "bg-transparent border-border text-text-muted saturate-80 opacity-80 hover:border-primary/30 hover:scale-105 hover:saturate-100 hover:opacity-100",
            },
            {
                kind: "chip",
                selected: true,
                tone: "success",
                className: "border-green-600 bg-green-600 text-white",
            },
            {
                kind: "chip",
                selected: false,
                tone: "success",
                className: "border-border bg-white text-text-secondary hover:border-green-300 hover:text-green-600 dark:bg-surface-subtle",
            },
            {
                kind: "chip",
                selected: true,
                tone: "neutral",
                className: "border-slate-800 bg-slate-800 text-white",
            },
            {
                kind: "chip",
                selected: false,
                tone: "neutral",
                className: "border-border bg-white text-text-secondary hover:border-slate-300 hover:text-slate-800 dark:bg-surface-subtle",
            },
            {
                kind: "compact",
                selected: true,
                tone: "primary",
                className: "border-primary bg-primary text-primary-foreground shadow-md",
            },
            {
                kind: "compact",
                selected: false,
                tone: "primary",
                className: "border-border bg-surface-base text-text-secondary hover:border-primary/30",
            },
        ],
        defaultVariants: {
            kind: "compact",
            selected: false,
            tone: "primary",
        },
    }
)

export interface FeedbackChoiceButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof feedbackChoiceVariants> {}

export function FeedbackChoiceButton({
    className,
    kind,
    selected,
    tone,
    ...props
}: FeedbackChoiceButtonProps) {
    return <button className={cn(feedbackChoiceVariants({ kind, selected, tone }), className)} {...props} />
}
