'use client';

import { motion } from 'framer-motion';
import WorkReel from './WorkReel';

export default function BrandLogo() {
    return (
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight font-display py-8 leading-none select-none flex items-baseline justify-center">
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="text-blue-500"
            >
                Ready
            </motion.span>
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="text-brand-orange"
            >
                2
            </motion.span>
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.4 }}
                className="relative inline-flex items-baseline text-left translate-y-[0]"
            >
                {/* Phantom text to set stable layout width and baseline anchor */}
                <span className="invisible pointer-events-none font-display font-bold tracking-tight">Work</span>

                {/* Actual reel positioned over the phantom baseline */}
                <div className="absolute left-0 top-0 w-[20rem] overflow-visible">
                    <WorkReel />
                </div>
            </motion.span>
        </h1>
    );
}
