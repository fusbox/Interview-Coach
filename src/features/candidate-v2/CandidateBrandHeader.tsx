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
        <header className="candidate-brand-header" aria-label="NJ Career Interview Coach">
            <div className={`candidate-brand-header__inner app-grid${frameClass}`}>
                <Link className="candidate-brand-header__identity" href="/" aria-label="NJ Career Interview Coach home">
                    <Image
                        src="/njcareer-logo.png"
                        alt="NJ Career"
                        width={520}
                        height={120}
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
