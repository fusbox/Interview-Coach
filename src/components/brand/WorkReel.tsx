'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { tech, classic, academic, industrial, signage } from '@/lib/fonts';

const fonts = [
    { className: `${tech.variable} font-tech pl-[0.1em]`, label: 'Work', scale: 0.98, yOffset: '-0.052em' },
    { className: `${classic.variable} font-classic`, label: 'Work', scale: 1.07, yOffset: '-0.088em' },
    { className: `${academic.variable} font-academic`, label: 'Work', scale: 1.25, yOffset: '-0.103em' },
    { className: `${industrial.variable} font-industrial pl-[0.05em]`, label: 'Work', scale: 1.02, yOffset: '-0.105em' },
    { className: `${signage.variable} font-signage`, label: 'Work', scale: 1.03, yOffset: '0.04em' },
    { className: 'font-display font-bold tracking-tighter', label: 'Work', scale: 1.0, yOffset: '-0.07em' },
];

export default function WorkReel() {
    const [index, setIndex] = useState(-1);
    // Increased slot height from 1em to 1.6em to provide vertical "leak protection" buffer
    const slotHeight = 1.6;

    useEffect(() => {
        const delayTimer = setTimeout(() => {
            setIndex(0); // Scroll into first font precisely at the 1.3s mark
            const timer = setInterval(() => {
                setIndex((prev) => {
                    if (prev >= fonts.length - 1) {
                        clearInterval(timer);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 300);
            return () => clearInterval(timer);
        }, 1300);

        return () => clearTimeout(delayTimer);
    }, []);

    return (
        <span className="relative flex flex-col overflow-hidden h-[1.2em] w-[20rem]">
            <motion.span
                animate={{ y: -(index * slotHeight + (slotHeight - 1.2) / 2) + 'em' }}
                transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 40,
                    mass: 0.8
                }}
                className="flex flex-col"
            >
                {fonts.map((f, i) => (
                    <span
                        key={i}
                        className={`flex items-center justify-start ${f.className} text-brand-deep whitespace-nowrap leading-none transition-all duration-300`}
                        style={{
                            height: `${slotHeight}em`,
                            transform: `scale(${f.scale}) translateY(${f.yOffset})`,
                            transformOrigin: 'left center'
                        }}
                    >
                        {f.label}
                    </span>
                ))}
            </motion.span>
        </span>
    );
}
