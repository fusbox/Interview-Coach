"use client";

import { X } from "lucide-react";
import type {
    HTMLAttributes,
    ReactNode,
    Ref,
} from "react";

import { cn } from "@/lib/cn";

type CandidateOpenedSurfaceHeaderBadge = {
    label: string;
    value: ReactNode;
};

export type CandidateOpenedSurfaceHeaderProps = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
    badge?: CandidateOpenedSurfaceHeaderBadge;
    closeButtonRef?: Ref<HTMLButtonElement>;
    closeDisabled?: boolean;
    closeLabel: string;
    context?: ReactNode;
    navigation?: ReactNode;
    onClose: () => void;
    title: ReactNode;
    titleId: string;
};

export function CandidateOpenedSurfaceHeader({
    badge,
    className,
    closeButtonRef,
    closeDisabled = false,
    closeLabel,
    context,
    navigation,
    onClose,
    title,
    titleId,
    ...headerProps
}: CandidateOpenedSurfaceHeaderProps) {
    return (
        <header
            className={cn("candidate-opened-surface-header", className)}
            data-has-navigation={navigation ? "true" : undefined}
            {...headerProps}
        >
            <div className="candidate-opened-surface-header__identity">
                {context ? <p className="candidate-opened-surface-header__context">{context}</p> : null}
                <div className="candidate-opened-surface-header__title-row">
                    <h2 id={titleId}>{title}</h2>
                    {badge ? (
                        <span
                            className="candidate-opened-surface-header__badge"
                            aria-label={badge.label}
                        >
                            {badge.value}
                        </span>
                    ) : null}
                </div>
            </div>
            <button
                ref={closeButtonRef}
                className="candidate-opened-surface-header__close"
                type="button"
                disabled={closeDisabled}
                onClick={onClose}
                aria-label={closeLabel}
            >
                <X size={19} aria-hidden="true" />
            </button>
            {navigation ? (
                <div className="candidate-opened-surface-header__navigation">
                    {navigation}
                </div>
            ) : null}
        </header>
    );
}
