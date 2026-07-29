import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type CandidateBrandHeaderProps = {
    actions?: ReactNode;
    frame?: "default" | "workflow" | "form-flow" | "focused";
    label?: string;
};

export function CandidateBrandHeader({
    actions,
    frame = "default",
    label = "Interview Coach",
}: CandidateBrandHeaderProps) {
    const frameClass = frame === "default" ? "" : ` app-grid--${frame}`;

    return (
        <header className="candidate-brand-header" aria-label="TalentArbor Interview Coach">
            <div className={`candidate-brand-header__inner app-grid${frameClass}`}>
                <Link className="candidate-brand-header__identity" href="/" aria-label="TalentArbor Interview Coach home">
                    <Image
                        src="/TA-logo.webp"
                        alt="TalentArbor"
                        width={300}
                        height={70}
                        className="candidate-brand-header__mark"
                        priority
                        unoptimized
                    />
                    <span aria-hidden="true">{label}</span>
                </Link>
                {actions ? <div className="candidate-brand-header__actions">{actions}</div> : null}
            </div>
        </header>
    );
}
