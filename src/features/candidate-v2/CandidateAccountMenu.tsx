"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CandidateLogoutButton } from "@/features/candidate-auth-v2/CandidateLogoutButton";

export function CandidateAccountMenu({
    initials,
    identityLabel,
}: {
    initials: string;
    identityLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;

        function closeOnOutsidePointer(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        }

        function closeOnEscape(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            setOpen(false);
            triggerRef.current?.focus();
        }

        document.addEventListener("pointerdown", closeOnOutsidePointer);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsidePointer);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [open]);

    return (
        <div className="candidate-dashboard-account-menu" data-open={open} ref={rootRef}>
            <button
                type="button"
                className="candidate-dashboard-identity candidate-dashboard-account-menu__trigger"
                aria-label={`${open ? "Close" : "Open"} account menu for ${identityLabel}`}
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen((current) => !current)}
                ref={triggerRef}
            >
                <span aria-hidden="true">{initials}</span>
            </button>
            {open ? (
                <div
                    className="candidate-dashboard-account-menu__popover"
                    id={menuId}
                    role="group"
                    aria-label="Account options"
                >
                    <CandidateLogoutButton className="candidate-dashboard-account-menu__logout" />
                </div>
            ) : null}
        </div>
    );
}
