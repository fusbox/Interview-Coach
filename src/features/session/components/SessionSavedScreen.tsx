"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSession } from "../context/SessionContext";
import { PlayCircle, Save } from "lucide-react";
import { ContentCard } from "@/components/patterns/ContentCard";
import { IconBadge } from "@/components/patterns/IconBadge";

export default function SessionSavedScreen() {
    const { updateSession, session } = useSession();

    const handleResume = async () => {
        if (!session) return;
        // Simpler: Just set status to 'IN_SESSION' and let Orchestrator routing handle it.
        // If current index has answer + analysis, logic might auto-route to REVIEWING?
        await updateSession(session.id, { status: 'IN_SESSION' });
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 w-full max-w-md"
            >
                <ContentCard density="hero" align="center" className="space-y-8">
                    <IconBadge icon={Save} variant="primary" size="lg" className="mx-auto h-20 w-20 rounded-3xl shadow-raised-2" />

                    <div className="space-y-3">
                        <h1 className="font-display text-[2.5rem] font-bold leading-none text-text-primary">
                            Session Saved
                        </h1>
                        <p className="text-lg font-medium text-text-secondary">
                            Your progress is safely stored. Pick up right where you left off.
                        </p>
                    </div>

                    <div className="pt-4">
                        <Button
                            emphasis="primary"
                            density="hero"
                            shape="app"
                            label="strong"
                            className="h-16 w-full gap-3 text-lg"
                            onClick={handleResume}
                        >
                            Resume Session
                            <PlayCircle size={24} />
                        </Button>
                    </div>
                </ContentCard>
            </motion.div>
        </div>
    );
}
