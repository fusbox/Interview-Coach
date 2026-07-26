import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type CandidateBrandHeaderProps = {
    actions?: ReactNode;
    label?: string;
};

export function CandidateBrandHeader({
    actions,
    label = "Interview Coach",
}: CandidateBrandHeaderProps) {
    return (
        <header className="candidate-brand-header" aria-label="TalentArbor Interview Coach">
            <div className="candidate-brand-header__inner app-grid">
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
