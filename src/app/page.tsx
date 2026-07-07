import Image from "next/image";
import Link from "next/link";
import {
    ArrowUpRight,
    BarChart3,
    Briefcase,
    LockKeyhole,
    MessageCircle,
    ShieldCheck,
    Target,
    UserRound,
} from "lucide-react";

import { CandidateDisclosureFooter } from "@/components/shell/CandidateDisclosureFooter";

const audienceRoutes = [
    {
        title: "Job seekers",
        body: "Find roles on TalentArbor, then prepare for the one in front of you.",
        href: "https://talentarbor.com/job-seeker",
        action: "For job seekers",
        icon: UserRound,
    },
    {
        title: "Employers",
        body: "See how Rangam supports inclusive hiring and candidate preparation.",
        href: "https://rangam.com/employers",
        action: "For employers",
        icon: Briefcase,
    },
] as const;

const productDifferentiators = [
    {
        title: "Coaching, not scoring",
        body: "Interview Coach does not turn practice into a grade. It helps you see what is working, what needs structure, and what to try next.",
        detail: "No candidate score",
        icon: MessageCircle,
        tone: "standard",
    },
    {
        title: "Practice on your own terms",
        body: "Work through one answer, one question type, or a fuller round. You can build confidence piece by piece without sitting for a whole session every time.",
        detail: "Flexible practice",
        icon: Target,
        tone: "standard",
    },
    {
        title: "Learn what the question is really asking",
        body: "The coach is grounded in interview question types, why employers use them, and how stronger answers are usually shaped.",
        detail: "Interview know-how",
        icon: BarChart3,
        tone: "standard",
    },
    {
        title: "Built for many kinds of work",
        body: "Use it for frontline, service, skilled, professional, technical, or corporate roles. The coach starts from the job you are preparing for.",
        detail: "All job types",
        icon: Briefcase,
        tone: "inclusive",
    },
] as const;

const trustPoints = [
    "Candidate-led practice",
    "Protected practice data",
    "Not for hiring decisions",
] as const;

export default function Home() {
    return (
        <main className="candidate-design-system public-page">
            <header className="public-header">
                <div className="public-header__inner">
                    <Link href="/" aria-label="TalentArbor Interview Coach" className="brand-lockup">
                        <Image
                            src="/TA-logo.webp"
                            alt=""
                            width={300}
                            height={70}
                            className="brand-lockup__mark"
                            priority
                            unoptimized
                        />
                    </Link>
                    <Link href="/login" className="utility-link">
                        Employee login
                    </Link>
                </div>
            </header>

            <section className="gateway-hero" aria-labelledby="gateway-heading">
                <div className="gateway-hero__inner app-grid">
                    <div className="gateway-hero__copy">
                        <p className="eyebrow">TalentArbor Interview Coach</p>
                        <h1 id="gateway-heading" className="gateway-title">
                            Interview Coach
                        </h1>
                        <p className="gateway-lede">Practice with coaching, not a score.</p>
                        <p className="gateway-copy">
                            Use role-based questions and coach feedback to strengthen your answers without turning
                            practice into a score. Your practice is for preparation and your own review, not employer
                            hiring decisions.
                        </p>
                    </div>

                    <div className="gateway-audience" aria-label="Choose your path">
                        <p className="gateway-audience__label">Choose where to go next</p>
                        {audienceRoutes.map(({ title, body, href, action, icon: Icon }) => (
                            <Link href={href} className="audience-choice motion-surface" key={title}>
                                <span className="audience-choice__icon" aria-hidden="true">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span className="audience-choice__copy">
                                    <strong>{title}</strong>
                                    <span>{body}</span>
                                </span>
                                <span className="audience-choice__action">
                                    {action}
                                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="product-proof-section" aria-labelledby="product-proof-heading">
                <div className="app-grid">
                    <div className="section-heading section-heading--split">
                        <div>
                            <p className="eyebrow">What makes it useful</p>
                            <h2 id="product-proof-heading" className="section-title">
                                Level up on your own terms.
                            </h2>
                        </div>
                        <p className="section-copy">
                            Interview Coach is built for learning, not ranking. It gives you grounded guidance about
                            interview questions, adapts to the job in front of you, and lets you practice in the amount
                            that fits the moment.
                        </p>
                    </div>

                    <div className="product-proof-grid">
                        {productDifferentiators.map(({ title, body, detail, icon: Icon, tone }) => (
                            <article
                                className={`product-proof-card${tone === "inclusive" ? " product-proof-card--inclusive" : ""}`}
                                key={title}
                            >
                                <div className="product-proof-card__topline">
                                    <span className="product-proof-card__detail">{detail}</span>
                                    <span className="product-proof-card__icon" aria-hidden="true">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                </div>
                                <h3>{title}</h3>
                                <p>{body}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="assurance-band" aria-labelledby="assurance-heading">
                <div className="assurance-band__inner app-grid">
                    <div className="assurance-band__copy">
                        <span className="assurance-band__icon" aria-hidden="true">
                            <LockKeyhole className="h-6 w-6" />
                        </span>
                        <div>
                            <p className="eyebrow">Practice stays practice</p>
                            <h2 id="assurance-heading">For preparation, not hiring decisions.</h2>
                            <p>
                                Interview Coach uses AI to support candidate-led practice. Your answers and coach
                                feedback are protected by app access controls and are not used to make hiring decisions.
                            </p>
                        </div>
                    </div>

                    <ul className="assurance-list" aria-label="Interview Coach commitments">
                        {trustPoints.map((point) => (
                            <li key={point}>
                                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="closing-cta" aria-labelledby="closing-heading">
                <div className="closing-cta__inner app-grid">
                    <div>
                        <p className="eyebrow">Ready when you are</p>
                        <h2 id="closing-heading">Continue as a job seeker or employer.</h2>
                    </div>
                    <div className="closing-cta__actions">
                        <Link href="https://talentarbor.com/job-seeker" className="public-action public-action--primary">
                            For job seekers
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        <Link href="https://rangam.com/employers" className="public-action public-action--secondary">
                            For employers
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </section>

            <CandidateDisclosureFooter>
                Interview Coach uses AI to support practice coaching. Practice data is protected by app security and
                access controls, and is not used to make hiring decisions.
            </CandidateDisclosureFooter>
        </main>
    );
}
