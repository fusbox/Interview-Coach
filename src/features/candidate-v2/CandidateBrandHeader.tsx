import Link from "next/link";
import type { ReactNode } from "react";

import { InterviewCoachBrandMark } from "@/features/brand-v2/InterviewCoachBrandMark";
import { interviewCoachBrand } from "@/features/brand-v2/interview-coach-brand";

type CandidateBrandHeaderProps = {
    actions?: ReactNode;
    brandActions?: ReactNode;
    controls?: ReactNode;
    frame?: "default" | "workflow" | "form-flow" | "focused";
    label?: string;
};

export function CandidateBrandHeader({
    actions,
    brandActions,
    controls,
    frame = "default",
    label = "Interview Coach",
}: CandidateBrandHeaderProps) {
    const frameClass = frame === "default" ? "" : ` app-grid--${frame}`;
    const isStacked = Boolean(brandActions || controls);
    const identity = (
        <Link
            className="candidate-brand-header__identity"
            href="/"
            aria-label={`${interviewCoachBrand.displayName} Interview Coach home`}
        >
            <InterviewCoachBrandMark
                className="candidate-brand-header__mark"
                priority
            />
            <span aria-hidden="true">{label}</span>
        </Link>
    );

    return (
        <header className="candidate-brand-header" aria-label={`${interviewCoachBrand.displayName} Interview Coach`}>
            <div className={`candidate-brand-header__inner app-grid${frameClass}${isStacked ? " is-stacked" : ""}`}>
                {isStacked ? (
                    <>
                        <div className="candidate-brand-header__brand-row">
                            {identity}
                            {brandActions ? (
                                <div className="candidate-brand-header__brand-actions">{brandActions}</div>
                            ) : null}
                        </div>
                        <div className="candidate-brand-header__control-row">
                            {controls ? <div className="candidate-brand-header__controls">{controls}</div> : <span />}
                            {actions ? <div className="candidate-brand-header__actions">{actions}</div> : null}
                        </div>
                    </>
                ) : (
                    <>
                        {identity}
                        {actions ? <div className="candidate-brand-header__actions">{actions}</div> : null}
                    </>
                )}
            </div>
        </header>
    );
}
