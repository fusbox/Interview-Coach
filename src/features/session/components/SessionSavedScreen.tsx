"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSession } from "../context/SessionContext";
import { PlayCircle, Save } from "lucide-react";

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
                className="max-w-md w-full p-10 text-center space-y-8 relative z-10"
            >
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20">
                    <Save className="text-white w-10 h-10" />
                </div>

                <div className="space-y-3">
                    <h1 className="text-[2.5rem] font-bold text-text-primary leading-none font-display">
                        Session Saved
                    </h1>
                    <p className="text-text-secondary text-lg font-medium">
                        Your progress is safely stored. Pick up right where you left off.
                    </p>
                </div>

                <div className="pt-4">
                    <Button
                        size="lg"
                        className="w-full h-16 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-900/20 hover:shadow-blue-900/40 font-bold text-lg gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={handleResume}
                    >
                        Resume Session
                        <PlayCircle size={24} />
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
