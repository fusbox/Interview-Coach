"use client";

import React from "react";
import { motion } from "framer-motion";

export default function EnteringRoomScreen() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
        >
            <div className="text-center px-4">
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="text-slate-400 font-display text-sm tracking-[0.2em] font-medium uppercase"
                >
                    Entering interview room...
                </motion.p>
            </div>
        </motion.div>
    );
}
