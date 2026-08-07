"use client";

import { useCallback, useRef, useState } from "react";

export function useNavigationHandoff() {
    const [pending, setPending] = useState(false);
    const pendingRef = useRef(false);

    const claim = useCallback(() => {
        if (pendingRef.current) return false;
        pendingRef.current = true;
        setPending(true);
        return true;
    }, []);

    const release = useCallback(() => {
        pendingRef.current = false;
        setPending(false);
    }, []);

    return { pending, claim, release };
}
