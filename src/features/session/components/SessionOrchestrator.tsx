"use client";

import { useSession } from "../context/SessionContext";
import InitialsScreen from "./InitialsScreen";
import LandingScreen from "./LandingScreen";
import UnifiedSessionScreen from "./UnifiedSessionScreen";
// import ActiveQuestionScreen from "./ActiveQuestionScreen"; 
// import ReviewFeedbackScreen from "./ReviewFeedbackScreen";
import SummaryScreen from "./SummaryScreen";
import ErrorScreen from "./ErrorScreen";
import LoadingScreen from "./LoadingScreen";
import EnteringRoomScreen from "./EnteringRoomScreen";
import SessionSavedScreen from "./SessionSavedScreen";
import { Question } from "@/lib/domain/types";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";

export default function SessionOrchestrator() {
    const { now, session, startSession, isLoading /*, updateSession */ } = useSession();

    // Reset scroll on status or question change (SPA flow)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [now.status, now.currentQuestionId]);

    // Computed Context for Screens
    // TODO: Improve cleaner selector access either in Context or Hook
    const currentQ = session?.questions.find((q: Question) => q.id === now.currentQuestionId);

    const [isEntering, setIsEntering] = useState(false);

    // Actions Wrapper
    const handleStart = async () => {
        setIsEntering(true);
        // Fake transition period for narrative effect
        await new Promise(resolve => setTimeout(resolve, 1250));
        startSession("Product Manager"); // Default for V1
        setIsEntering(false);
    };

    // Render Logic
    if (isLoading && !session) return <LoadingScreen />; // Initial load
    if (now.status === "ERROR") return <ErrorScreen />;
    if (now.status === "GENERATING_QUESTIONS") return <LoadingScreen />; // Handle generation state
    if (now.status === "PAUSED") return <SessionSavedScreen />;
    if (now.requiresInitials || now.status === "NOT_STARTED") {
        return (
            <AnimatePresence mode="wait">
                {isEntering ? (
                    <EnteringRoomScreen key="entering" />
                ) : now.requiresInitials ? (
                    <InitialsScreen key="initials" />
                ) : (
                    <LandingScreen key="landing" onStart={handleStart} role={now.role} />
                )}
            </AnimatePresence>
        );
    }

    if (now.status === "IN_SESSION" || now.status === "AWAITING_EVALUATION" || now.status === "REVIEWING") {
        // Intake Bypass: We default to tier1 if not set, or just proceed.
        // The IntakeScreen is removed from flow.
        if (!session?.coachingPreference) {
            // Auto-set preference if needed
        }

        if (!currentQ) return <ErrorScreen />;
        return <UnifiedSessionScreen />;
    }

    if (now.status === "COMPLETED") return <SummaryScreen />;

    // Transitional Fallback (Avoid flashing ERROR during rehydration/navigation)
    if (isLoading || !session) return <LoadingScreen />;

    console.warn(`[Orchestrator] Fallthrough on Status: ${now.status}, Screen: ${now.screen}`);
    return <ErrorScreen />;
}
