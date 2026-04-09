"use client"

import type { Content } from "@radix-ui/react-popover"
import Link from "next/link"
import * as React from "react"
import { createPortal } from "react-dom"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "@/components/ui/popover"

export interface Step {
    id: string
    title: React.ReactNode
    content: React.ReactNode
    placement?: "auto" | "anchored" | "stacked" | "below"
    mobilePlacement?: "inherit" | "anchored" | "stacked" | "below"
    scrollBehavior?: "auto" | "none"
    showPrevious?: boolean
    cardWidth?: number
    nextRoute?: string
    previousRoute?: string
    nextLabel?: React.ReactNode
    previousLabel?: React.ReactNode
    side?: React.ComponentProps<typeof Content>["side"]
    sideOffset?: React.ComponentProps<typeof Content>["sideOffset"]
    align?: React.ComponentProps<typeof Content>["align"]
    alignOffset?: React.ComponentProps<typeof Content>["alignOffset"]
    className?: string
}

export interface Tour {
    id: string
    steps: Step[]
}

interface TourContextValue {
    start: (tourId: string) => void
    close: () => void
    isOpen: boolean
    activeTourId: string | null
    activeStep: Step | null
    activeStepId: string | null
    currentStepIndex: number
    totalSteps: number
}

interface TourTarget {
    rect: DOMRect
    radius: number
    element: HTMLElement
}

const TourContext = React.createContext<TourContextValue | null>(null)

const TOUR_LAYOUT_TOKENS = {
    viewportPadding: 16,
    anchoredWidth: 384,
    anchoredSideClearance: 32,
    responsiveBreakpoint: 1180,
    stacked: {
        overlap: 28,
        minHeight: 160,
        maxHeight: 224,
        minContentHeight: 72,
        reservedChromeHeight: 132,
    },
    below: {
        gap: 12,
        estimatedHeight: 260,
    },
} as const

const TOUR_SURFACE_GRADIENT_STYLE = {
    backgroundColor: "rgba(2, 6, 23, 0.94)",
    backgroundImage:
        "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 52%, rgba(148,163,184,0.06) 78%, rgba(226,232,240,0.12) 100%)",
} as const

const TOUR_CARD_STYLES = {
    shell: "overflow-hidden rounded-2xl border-white/10 text-text-inverse shadow-none backdrop-blur-xl",
    mobileShell: "max-h-none border-white/15",
    desktopShell: "max-h-[calc(100vh-2rem)]",
    anchoredContainer: "pointer-events-auto z-[121] w-[24rem] max-w-[calc(100vw-2rem)] rounded-2xl border-white/10 bg-transparent p-0 text-text-inverse shadow-[0_32px_80px_rgba(2,6,23,0.5)] ring-1 ring-white/10",
    header: "shrink-0 border-b border-white/10 bg-transparent",
    content: "overflow-y-auto text-text-inverse/78",
    footer: "shrink-0 justify-between border-t border-white/10 bg-transparent",
    title: "text-xl font-bold text-primary-foreground",
    closeButton: "text-text-inverse/70 hover:bg-white/10 hover:text-text-inverse",
    secondaryButton: "border-white/15 bg-white/5 text-text-inverse hover:bg-white/10 hover:text-text-inverse",
    primaryButton: "ml-auto bg-primary text-primary-foreground hover:bg-primary/90",
    mobileButton: "h-8 px-3 text-xs",
} as const

const TOUR_CARD_LAYOUTS = {
    desktop: {
        headerPadding: "px-6 py-5",
        contentPadding: "px-6 py-5 text-sm leading-6",
        footerPadding: "px-6 py-5",
    },
    mobile: {
        headerPadding: "px-4 py-4",
        contentPadding: "max-h-[88px] px-4 py-4 text-[13px] leading-5",
        footerPadding: "px-4 py-4",
    },
} as const

function resetTourState(setIsOpen: (value: boolean) => void, setActiveTourId: (value: string | null) => void, setCurrentStepIndex: (value: number) => void) {
    setIsOpen(false)
    setCurrentStepIndex(0)
    setActiveTourId(null)
}

function getMatchingTourTargets(stepId: string) {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-tour-step-id]")).filter((element) => {
        const attributeValue = element.getAttribute("data-tour-step-id")
        if (!attributeValue) {
            return false
        }

        return attributeValue.split(/[\s,]+/).includes(stepId)
    })
}

function getDesiredTargetTop({
    placement,
    side,
    cardHeight,
    sideOffset,
    viewportPadding,
    stackedOverlap,
}: {
    placement: "anchored" | "stacked" | "below"
    side: React.ComponentProps<typeof Content>["side"]
    cardHeight: number
    sideOffset: number
    viewportPadding: number
    stackedOverlap: number
}) {
    if (placement === "stacked") {
        return Math.max(
            viewportPadding,
            cardHeight - stackedOverlap + 12
        )
    }

    if (placement === "anchored" && side === "top") {
        return cardHeight + sideOffset + viewportPadding
    }

    return viewportPadding
}

export function TourProvider({
    tours,
    children,
    onComplete,
}: {
    tours: Tour[]
    children: React.ReactNode
    onComplete?: (tourId: string) => void
}) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [activeTourId, setActiveTourId] = React.useState<string | null>(null)
    const [currentStepIndex, setCurrentStepIndex] = React.useState(0)

    const activeTour = React.useMemo(
        () => tours.find((tour) => tour.id === activeTourId) ?? null,
        [activeTourId, tours]
    )
    const steps = activeTour?.steps ?? []
    const activeStep = steps[currentStepIndex] ?? null

    const close = React.useCallback(() => {
        resetTourState(setIsOpen, setActiveTourId, setCurrentStepIndex)
    }, [])

    const start = React.useCallback(
        (tourId: string) => {
            const tour = tours.find((entry) => entry.id === tourId)
            if (!tour) {
                console.error(`Tour with id '${tourId}' not found.`)
                return
            }

            if (tour.steps.length === 0) {
                console.error(`Tour with id '${tourId}' has no steps.`)
                return
            }

            setActiveTourId(tourId)
            setCurrentStepIndex(0)
            setIsOpen(true)
        },
        [tours]
    )

    const next = React.useCallback(() => {
        if (!activeTour) {
            return
        }

        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex((previous) => previous + 1)
            return
        }

        onComplete?.(activeTour.id)
        resetTourState(setIsOpen, setActiveTourId, setCurrentStepIndex)
    }, [activeTour, currentStepIndex, onComplete, steps.length])

    const previous = React.useCallback(() => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex((previousIndex) => previousIndex - 1)
        }
    }, [currentStepIndex])

    const value = React.useMemo<TourContextValue>(
        () => ({
            start,
            close,
            isOpen,
            activeTourId,
            activeStep,
            activeStepId: activeStep?.id ?? null,
            currentStepIndex,
            totalSteps: steps.length,
        }),
        [activeStep, activeTourId, close, currentStepIndex, isOpen, start, steps.length]
    )

    return (
        <TourContext.Provider value={value}>
            {children}
            {isOpen && activeStep ? (
                <TourOverlay
                    step={activeStep}
                    currentStepIndex={currentStepIndex}
                    totalSteps={steps.length}
                    onNext={next}
                    onPrevious={previous}
                    onClose={close}
                />
            ) : null}
        </TourContext.Provider>
    )
}

export function useTour() {
    const context = React.useContext(TourContext)

    if (!context) {
        throw new Error("useTour must be used within a TourProvider")
    }

    return context
}

function TourOverlay({
    step,
    currentStepIndex,
    totalSteps,
    onNext,
    onPrevious,
    onClose,
}: {
    step: Step
    currentStepIndex: number
    totalSteps: number
    onNext: () => void
    onPrevious: () => void
    onClose: () => void
}) {
    const [mounted, setMounted] = React.useState(false)
    const [targets, setTargets] = React.useState<TourTarget[]>([])
    const cardRef = React.useRef<HTMLDivElement | null>(null)
    const scrolledStepRef = React.useRef<string | null>(null)

    React.useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    React.useEffect(() => {
        if (!mounted) {
            return
        }

        const updatePosition = () => {
            const validTargets = getMatchingTourTargets(step.id)
                .map<{ rect: DOMRect; radius: number; element: HTMLElement } | null>((element) => {
                    const rect = element.getBoundingClientRect()
                    if (rect.width === 0 && rect.height === 0) {
                        return null
                    }

                    const styles = window.getComputedStyle(element)
                    const radius = Number.parseFloat(styles.borderRadius) || 4

                    return { rect, radius, element }
                })
                .filter((value): value is { rect: DOMRect; radius: number; element: HTMLElement } => value !== null)

            setTargets(validTargets)
        }

        const frame = window.requestAnimationFrame(updatePosition)
        const handleResizeOrScroll = () => updatePosition()

        window.addEventListener("resize", handleResizeOrScroll)
        window.addEventListener("scroll", handleResizeOrScroll, true)

        const mutationObserver = new MutationObserver(updatePosition)
        mutationObserver.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
        })

        const resizeObserver = new ResizeObserver(updatePosition)
        resizeObserver.observe(document.body)

        return () => {
            window.cancelAnimationFrame(frame)
            window.removeEventListener("resize", handleResizeOrScroll)
            window.removeEventListener("scroll", handleResizeOrScroll, true)
            mutationObserver.disconnect()
            resizeObserver.disconnect()
        }
    }, [mounted, step.id])

    const primaryTarget = targets[0] ?? null
    const viewportPadding = TOUR_LAYOUT_TOKENS.viewportPadding
    const anchoredCardWidth = Math.min(step.cardWidth ?? TOUR_LAYOUT_TOKENS.anchoredWidth, window.innerWidth - viewportPadding * 2)
    const estimatedCardWidth = anchoredCardWidth
    const estimatedCardHeight = Math.min(340, window.innerHeight - viewportPadding * 2)
    const availableSpace = {
        right: primaryTarget ? window.innerWidth - primaryTarget.rect.right - viewportPadding : 0,
        left: primaryTarget ? primaryTarget.rect.left - viewportPadding : 0,
        bottom: primaryTarget ? window.innerHeight - primaryTarget.rect.bottom - viewportPadding : 0,
        top: primaryTarget ? primaryTarget.rect.top - viewportPadding : 0,
    }
    const requestedPlacement =
        window.innerWidth < TOUR_LAYOUT_TOKENS.responsiveBreakpoint &&
        step.mobilePlacement &&
        step.mobilePlacement !== "inherit"
            ? step.mobilePlacement
            : (step.placement ?? "auto")
    const resolvedPlacement = (() => {
        if (requestedPlacement === "anchored" || requestedPlacement === "stacked" || requestedPlacement === "below") {
            return requestedPlacement
        }

        if (
            window.innerWidth < TOUR_LAYOUT_TOKENS.responsiveBreakpoint ||
            Math.max(availableSpace.left, availableSpace.right) <
                estimatedCardWidth + TOUR_LAYOUT_TOKENS.anchoredSideClearance
        ) {
            return "stacked" as const
        }

        return "anchored" as const
    })()

    const resolvedSide = (() => {
        if (step.side) {
            return step.side
        }

        if (availableSpace.right >= estimatedCardWidth) {
            return "right" as const
        }

        if (availableSpace.left >= estimatedCardWidth) {
            return "left" as const
        }

        if (availableSpace.bottom >= estimatedCardHeight) {
            return "bottom" as const
        }

        if (availableSpace.top >= estimatedCardHeight) {
            return "top" as const
        }

        const rankedSides = [
            { side: "right" as const, value: availableSpace.right },
            { side: "left" as const, value: availableSpace.left },
            { side: "bottom" as const, value: availableSpace.bottom },
            { side: "top" as const, value: availableSpace.top },
        ].sort((left, right) => right.value - left.value)

        return rankedSides[0]?.side ?? "right"
    })()

    const resolvedAlign =
        step.align ??
        (resolvedSide === "left" || resolvedSide === "right" ? "start" : "center")

    const nextButtonLabel =
        step.nextLabel ?? (currentStepIndex === totalSteps - 1 ? "Finish" : "Next")

    const stackedCardWidth = Math.min(
        primaryTarget?.rect.width ?? window.innerWidth - viewportPadding * 2,
        window.innerWidth - viewportPadding * 2
    )
    const stackedCardLeft = Math.min(
        Math.max(primaryTarget?.rect.left ?? viewportPadding, viewportPadding),
        window.innerWidth - viewportPadding - stackedCardWidth
    )
    const stackedOverlapAllowance = TOUR_LAYOUT_TOKENS.stacked.overlap
    const stackedCardMaxHeight = Math.min(
        TOUR_LAYOUT_TOKENS.stacked.maxHeight,
        Math.max(
            TOUR_LAYOUT_TOKENS.stacked.minHeight,
            (primaryTarget?.rect.top ?? viewportPadding) - viewportPadding + stackedOverlapAllowance
        )
    )
    const stackedCardTop = Math.max(
        viewportPadding,
        (primaryTarget?.rect.top ?? viewportPadding) - stackedCardMaxHeight + stackedOverlapAllowance
    )
    const stackedContentMaxHeight = Math.max(
        TOUR_LAYOUT_TOKENS.stacked.minContentHeight,
        stackedCardMaxHeight - TOUR_LAYOUT_TOKENS.stacked.reservedChromeHeight
    )
    const usesCompactCardChrome = window.innerWidth < TOUR_LAYOUT_TOKENS.responsiveBreakpoint
    const cardLayout = usesCompactCardChrome ? TOUR_CARD_LAYOUTS.mobile : TOUR_CARD_LAYOUTS.desktop
    const belowCardWidth = anchoredCardWidth
    const belowCardLeft = Math.min(
        Math.max((primaryTarget?.rect.left ?? viewportPadding) + (((primaryTarget?.rect.width ?? belowCardWidth) - belowCardWidth) / 2), viewportPadding),
        window.innerWidth - viewportPadding - belowCardWidth
    )
    const belowCardTop = Math.min(
        (primaryTarget?.rect.bottom ?? viewportPadding) + TOUR_LAYOUT_TOKENS.below.gap,
        window.innerHeight - viewportPadding - TOUR_LAYOUT_TOKENS.below.estimatedHeight
    )

    React.useEffect(() => {
        if (!mounted || !primaryTarget) {
            return
        }

        if (scrolledStepRef.current === step.id) {
            return
        }

        if (step.scrollBehavior === "none") {
            scrolledStepRef.current = step.id
            return
        }

        if (window.getComputedStyle(primaryTarget.element).position === "fixed") {
            scrolledStepRef.current = step.id
            return
        }

        const frame = window.requestAnimationFrame(() => {
            const measuredTargetTop = primaryTarget.element.getBoundingClientRect().top
            const cardHeight = cardRef.current?.getBoundingClientRect().height ?? 0
            const desiredTargetTop = getDesiredTargetTop({
                placement: resolvedPlacement,
                side: resolvedSide,
                cardHeight,
                sideOffset: step.sideOffset ?? 16,
                viewportPadding,
                stackedOverlap: TOUR_LAYOUT_TOKENS.stacked.overlap,
            })
            const maxScrollTop = Math.max(
                document.documentElement.scrollHeight - window.innerHeight,
                0
            )
            const nextScrollTop = Math.min(
                Math.max(window.scrollY + measuredTargetTop - desiredTargetTop, 0),
                maxScrollTop
            )

            if (Math.abs(window.scrollY - nextScrollTop) > 4) {
                window.scrollTo({
                    top: nextScrollTop,
                    behavior: "smooth",
                })
            }

            scrolledStepRef.current = step.id
        })

        return () => window.cancelAnimationFrame(frame)
    }, [
        mounted,
        resolvedPlacement,
        resolvedSide,
        step.id,
        step.scrollBehavior,
        step.sideOffset,
        primaryTarget,
        viewportPadding,
    ])

    if (!mounted || !primaryTarget) {
        return null
    }

    const cardBody = (
        <div ref={cardRef}>
            <Card
                className={cn(
                    TOUR_CARD_STYLES.shell,
                    resolvedPlacement === "stacked" ? TOUR_CARD_STYLES.mobileShell : TOUR_CARD_STYLES.desktopShell
                )}
                style={TOUR_SURFACE_GRADIENT_STYLE}
            >
                <CardHeader
                    className={cn(
                        TOUR_CARD_STYLES.header,
                        cardLayout.headerPadding
                    )}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <CardTitle className={TOUR_CARD_STYLES.title}>
                                {step.title}
                            </CardTitle>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            aria-label="Close tour"
                            className={cn(
                                TOUR_CARD_STYLES.closeButton,
                                usesCompactCardChrome ? "h-8 w-8" : ""
                            )}
                        >
                            <XIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent
                    className={cn(TOUR_CARD_STYLES.content, cardLayout.contentPadding)}
                    style={
                        resolvedPlacement === "stacked"
                            ? { maxHeight: stackedContentMaxHeight }
                            : undefined
                    }
                >
                    {step.content}
                </CardContent>
                <CardFooter
                    className={cn(
                        TOUR_CARD_STYLES.footer,
                        cardLayout.footerPadding
                    )}
                >
                    {currentStepIndex > 0 && step.showPrevious !== false ? (
                        step.previousRoute ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onPrevious}
                                asChild
                                className={cn(
                                    TOUR_CARD_STYLES.secondaryButton,
                                    usesCompactCardChrome ? TOUR_CARD_STYLES.mobileButton : ""
                                )}
                            >
                                <Link href={step.previousRoute}>
                                    {step.previousLabel ?? "Previous"}
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onPrevious}
                                className={cn(
                                    TOUR_CARD_STYLES.secondaryButton,
                                    usesCompactCardChrome ? TOUR_CARD_STYLES.mobileButton : ""
                                )}
                            >
                                {step.previousLabel ?? "Previous"}
                            </Button>
                        )
                    ) : (
                        <span />
                    )}

                    {step.nextRoute ? (
                        <Button
                            type="button"
                            className={cn(
                                TOUR_CARD_STYLES.primaryButton,
                                usesCompactCardChrome ? TOUR_CARD_STYLES.mobileButton : ""
                            )}
                            onClick={onNext}
                            asChild
                        >
                            <Link href={step.nextRoute}>{nextButtonLabel}</Link>
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            className={cn(
                                TOUR_CARD_STYLES.primaryButton,
                                usesCompactCardChrome ? TOUR_CARD_STYLES.mobileButton : ""
                            )}
                            onClick={onNext}
                        >
                            {nextButtonLabel}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )

    return createPortal(
        <div className="pointer-events-none fixed inset-0 z-[120]">
            <svg className="pointer-events-none absolute inset-0 size-full">
                <defs>
                    <mask id="tour-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targets.map((target, index) => (
                            <rect
                                key={`${step.id}-mask-${index}`}
                                x={target.rect.left}
                                y={target.rect.top}
                                width={target.rect.width}
                                height={target.rect.height}
                                rx={target.radius}
                                fill="black"
                            />
                        ))}
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    mask="url(#tour-mask)"
                    className="fill-black/55"
                />
                {targets.map((target, index) => (
                    <rect
                        key={`${step.id}-outline-${index}`}
                        x={target.rect.left}
                        y={target.rect.top}
                        width={target.rect.width}
                        height={target.rect.height}
                        rx={target.radius}
                        className="fill-none stroke-primary stroke-2"
                    />
                ))}
            </svg>

            {resolvedPlacement === "below" ? (
                <div
                    className={cn("pointer-events-auto fixed z-[121]", step.className)}
                    style={{
                        left: belowCardLeft,
                        top: belowCardTop,
                        width: belowCardWidth,
                    }}
                >
                    {cardBody}
                </div>
            ) : resolvedPlacement === "stacked" ? (
                <div
                    className={cn("pointer-events-auto fixed z-[121]", step.className)}
                    style={{
                        left: stackedCardLeft,
                        top: stackedCardTop,
                        width: stackedCardWidth,
                        maxHeight: stackedCardMaxHeight,
                    }}
                >
                    {cardBody}
                </div>
            ) : (
                <Popover key={step.id} open>
                    <PopoverAnchor
                        virtualRef={{
                            current: {
                                getBoundingClientRect: () =>
                                    targets[0]?.rect ?? new DOMRect(0, 0, 0, 0),
                            },
                        }}
                    />
                    <PopoverContent
                        className={cn(
                            TOUR_CARD_STYLES.anchoredContainer,
                            step.className
                        )}
                        side={resolvedSide}
                        sideOffset={step.sideOffset ?? 16}
                        align={resolvedAlign}
                        alignOffset={step.alignOffset}
                        style={{ width: anchoredCardWidth }}
                        collisionPadding={16}
                        onOpenAutoFocus={(event) => event.preventDefault()}
                        onCloseAutoFocus={(event) => event.preventDefault()}
                        asChild
                    >
                        {cardBody}
                    </PopoverContent>
                </Popover>
            )}
        </div>,
        document.body
    )
}
