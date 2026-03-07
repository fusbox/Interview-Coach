"use client";

import { useSession } from "../context/SessionContext";
import { audioEngine } from "@/features/audio/audio-engine";
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
import { AnimatePresence, motion } from "framer-motion";
import { TRANSITION_DURATION } from "@/lib/constants";

export default function SessionOrchestrator() {
    const { now, session, startSession, isLoading /*, updateSession */ } = useSession();

    // Reset scroll on status or question change (SPA flow)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [now.status, now.currentQuestionId]);

    const [isEntering, setIsEntering] = useState(false);

    // Sync transition overlay with status change to prevent glitch
    useEffect(() => {
        if (isEntering && (now.status === "IN_SESSION" || now.status === "AWAITING_EVALUATION" || now.status === "REVIEWING")) {
            // Keep overlay for an extra 200ms to allow UnifiedSessionScreen to mount and start fade
            const timer = setTimeout(() => setIsEntering(false), 200);
            return () => clearTimeout(timer);
        }
    }, [now.status, isEntering]);

    // Computed Context for Screens
    // TODO: Improve cleaner selector access either in Context or Hook
    const currentQ = session?.questions.find((q: Question) => q.id === now.currentQuestionId);

    // Actions Wrapper
    const handleStart = async () => {
        audioEngine.unlock(); // User gesture: unlock immediately
        setIsEntering(true);
        // Narrative wait
        await new Promise(resolve => setTimeout(resolve, 1250));
        const role = session?.role || "General Interview";
        startSession(role); // Use dynamic role from context if available

        // Safety: ensure overlay clears even if status check fails for some reason
        const timer = setTimeout(() => setIsEntering(false), 3000);
        return () => clearTimeout(timer);
    };

    // Render Logic Helper
    const renderScreen = () => {
        if (isLoading && !session) return <LoadingScreen key="loading-initial" />;
        if (now.status === "ERROR") return <ErrorScreen key="error" />;
        if (now.status === "GENERATING_QUESTIONS") return <LoadingScreen key="loading-gen" />;
        if (now.status === "PAUSED") return <SessionSavedScreen key="saved" />;

        if (now.requiresInitials || now.status === "NOT_STARTED") {
            if (now.requiresInitials) return <InitialsScreen key="initials" />;
            return (
                <motion.div
                    key="landing-wrapper"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: TRANSITION_DURATION }}
                    className="h-full w-full"
                >
                    <LandingScreen key="landing" onStart={handleStart} role={now.role} />
                </motion.div>
            );
        }

        if (now.status === "IN_SESSION" || now.status === "AWAITING_EVALUATION" || now.status === "REVIEWING") {
            if (!currentQ) return <ErrorScreen key="error-missing-q" />;
            return (
                <motion.div
                    key="session-main"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: TRANSITION_DURATION, delay: isEntering ? 0.2 : 0 }} // Perfectly synchronized cross-fade
                    className="h-full w-full"
                >
                    <UnifiedSessionScreen />
                </motion.div>
            );
        }

        if (now.status === "COMPLETED") return <SummaryScreen key="summary" />;

        return <ErrorScreen key="error-fallback" />;
    };

    return (
        <>
            <AnimatePresence>
                {renderScreen()}
            </AnimatePresence>

            <AnimatePresence>
                {isEntering && <EnteringRoomScreen key="entering-overlay" />}
            </AnimatePresence>
        </>
    );
}
