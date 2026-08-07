"use client";

import { type ReactNode, useEffect, useRef } from "react";

export function CandidateDismissibleDetails({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    const detailsRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => {
        function closeOnOutsidePointer(event: PointerEvent) {
            const details = detailsRef.current;
            if (
                !details?.open
                || !(event.target instanceof Node)
                || details.contains(event.target)
            ) return;
            details.open = false;
        }

        document.addEventListener("pointerdown", closeOnOutsidePointer);
        return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
    }, []);

    return (
        <details
            className={className}
            ref={detailsRef}
        >
            {children}
        </details>
    );
}
