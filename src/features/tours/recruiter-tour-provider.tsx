"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { TourProvider, useTour } from "@/components/ui/tour"
import {
    recruiterTours,
    RECRUITER_CREATE_INVITE_TOUR_ID,
} from "@/features/tours/recruiter-tours"

const TOUR_COMPLETION_PREFIX = "tour-complete:"
export const TOUR_RESET_SEARCH_PARAM = "tourReset"

function getCompletionKey(tourId: string) {
    return `${TOUR_COMPLETION_PREFIX}${tourId}`
}

function RecruiterTourManager() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { activeTourId, start } = useTour()

    React.useEffect(() => {
        const requestedTourId = searchParams.get("tour")
        if (!requestedTourId) {
            return
        }

        const shouldResetTour = searchParams.get(TOUR_RESET_SEARCH_PARAM) === "1"

        if (
            typeof window !== "undefined" &&
            !shouldResetTour &&
            window.localStorage.getItem(getCompletionKey(requestedTourId)) === "true"
        ) {
            const nextParams = new URLSearchParams(searchParams.toString())
            nextParams.delete("tour")
            nextParams.delete(TOUR_RESET_SEARCH_PARAM)
            const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname
            router.replace(nextUrl)
            return
        }

        if (activeTourId !== requestedTourId || shouldResetTour) {
            start(requestedTourId)
        }

        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.delete("tour")
        nextParams.delete(TOUR_RESET_SEARCH_PARAM)
        const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname
        router.replace(nextUrl)
    }, [activeTourId, pathname, router, searchParams, start])

    return null
}

export function RecruiterTourProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const handleComplete = React.useCallback((tourId: string) => {
        if (typeof window === "undefined") {
            return
        }

        window.localStorage.setItem(getCompletionKey(tourId), "true")
    }, [])

    return (
        <TourProvider tours={recruiterTours} onComplete={handleComplete}>
            <RecruiterTourManager />
            {children}
        </TourProvider>
    )
}

export { RECRUITER_CREATE_INVITE_TOUR_ID }
