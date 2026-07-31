import type React from "react";
import Image from "next/image";

import { InterviewCoachBrandMark } from "@/features/brand-v2/InterviewCoachBrandMark";

type CandidateDisclosureFooterProps = {
    children?: React.ReactNode;
};

const defaultDisclosure =
    "Interview Coach uses AI to support practice coaching. Practice data is protected by app security and access controls, and is not used to make hiring decisions.";

const policyLinks = [
    { label: "Privacy Policy", href: "https://talentarbor.com/privacy-policy" },
    { label: "Cookie Policy", href: "https://talentarbor.com/cookie-policy" },
    { label: "Terms of Use", href: "https://talentarbor.com/terms-of-use" },
    { label: "Responsible AI Statement", href: "https://talentarbor.com/ResponsibleAIStatement" },
] as const;

export function CandidateDisclosureFooter({ children }: CandidateDisclosureFooterProps) {
    return (
        <footer className="site-footer">
            <div className="site-footer__inner">
                <div className="site-footer__brand-row">
                    <InterviewCoachBrandMark
                        className="site-footer__brand-logo"
                    />
                    <div className="site-footer__product-of">
                        <span>A product of</span>
                        <Image
                            src="/rangam-logo.webp"
                            alt="Rangam"
                            width={180}
                            height={68}
                            className="site-footer__rangam-logo"
                            unoptimized
                        />
                    </div>
                </div>

                <p className="site-footer__disclosure">{children ?? defaultDisclosure}</p>

                <nav className="site-footer__links" aria-label="Legal and policy links">
                    {policyLinks.map((link) => (
                        <a href={link.href} key={link.href}>
                            {link.label}
                        </a>
                    ))}
                </nav>

                <p className="site-footer__copyright">
                    &copy; 2026 Rangam Consultants Inc. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
