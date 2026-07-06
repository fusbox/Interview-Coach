import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Briefcase, FileText, LockKeyhole, MessageCircle, Target } from "lucide-react";

import { CandidateDisclosureFooter } from "@/components/shell/CandidateDisclosureFooter";
import { Button } from "@/components/ui/button";

const audienceRoutes = [
    {
        title: "Job seekers",
        body: "Practice for a real role, get clearer about your answers, and see what to work on next.",
        href: "https://talentarbor.com/job-seeker",
        action: "Visit TalentArbor",
        tone: "primary",
    },
    {
        title: "Employers",
        body: "Help candidates prepare with a supportive interview practice experience connected to Rangam.",
        href: "https://rangam.com/employers",
        action: "Visit Rangam",
        tone: "secondary",
    },
] as const;

const productHighlights = [
    {
        title: "Practice for the role in front of you",
        body: "Interview Coach uses the target role and job description to shape a focused practice round.",
        icon: Target,
    },
    {
        title: "Add resume context when it helps",
        body: "Resume content is optional. When included, it helps make questions and coaching more relevant.",
        icon: FileText,
    },
    {
        title: "Get coaching after each answer",
        body: "Feedback is meant to help you clarify examples, structure responses, and decide what to try again.",
        icon: MessageCircle,
    },
    {
        title: "Return to a preparedness dashboard",
        body: "After practice, the dashboard shows what has evidence and what would be useful to practice next.",
        icon: BarChart3,
    },
] as const;

export default function Home() {
    return (
        <main className="candidate-design-system public-page">
            <header className="public-header">
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
            </header>

            <section className="public-hero">
                <div className="public-hero__copy">
                    <h1 className="display-hero">Interview Coach</h1>
                    <p className="hero-statement">
                        Practice for interviews with AI-guided questions, answer coaching, and a dashboard that keeps
                        the next step clear.
                    </p>
                    <p className="hero-support">
                        Built for preparation, not hiring decisions. Candidate-led practice stays focused on learning,
                        confidence, and follow-through.
                    </p>
                </div>

                <div className="hero-visual" aria-label="Interview Coach preparation flow">
                    <div className="hero-visual__rail">
                        <span>Role context</span>
                        <span>Practice round</span>
                        <span>Coach feedback</span>
                        <span>Dashboard next step</span>
                    </div>
                    <div className="hero-visual__panel">
                        <Briefcase className="hero-visual__icon" aria-hidden="true" />
                        <p>Start from the job you are preparing for.</p>
                    </div>
                </div>
            </section>

            <section className="audience-band" aria-labelledby="audience-heading">
                <div className="section-heading">
                    <h2 id="audience-heading" className="section-title">
                        Choose the path that fits why you are here.
                    </h2>
                    <p className="section-copy">
                        Interview Coach is part of the TalentArbor candidate experience and connects employer interest
                        back to Rangam.
                    </p>
                </div>
                <div className="audience-grid">
                    {audienceRoutes.map((route) => (
                        <article className={`audience-panel audience-panel--${route.tone}`} key={route.title}>
                            <div>
                                <h3>{route.title}</h3>
                                <p>{route.body}</p>
                            </div>
                            <Button asChild density="comfortable" shape="app" label="strong" emphasis="secondary">
                                <Link href={route.href}>
                                    {route.action}
                                    <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
                                </Link>
                            </Button>
                        </article>
                    ))}
                </div>
            </section>

            <section className="explain-section" aria-labelledby="explain-heading">
                <div className="section-heading section-heading--center">
                    <h2 id="explain-heading" className="section-title">
                        What the app is built to do
                    </h2>
                    <p className="section-copy">
                        A short practice loop: prepare with context, answer questions, review coaching, then decide what
                        to practice next.
                    </p>
                </div>
                <div className="feature-row">
                    {productHighlights.map(({ title, body, icon: Icon }) => (
                        <article className="feature-card" key={title}>
                            <div className="feature-card__icon">
                                <Icon className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <h3>{title}</h3>
                            <p>{body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="trust-band" aria-labelledby="trust-heading">
                <div className="trust-band__icon">
                    <LockKeyhole className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                    <h2 id="trust-heading">Your practice stays yours.</h2>
                    <p>
                        Interview Coach uses AI for practice coaching. Candidate-led practice content is for preparation
                        and review, not employer hiring decisions.
                    </p>
                </div>
            </section>

            <CandidateDisclosureFooter />
        </main>
    );
}
