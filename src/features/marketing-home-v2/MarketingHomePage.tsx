import { CandidateDisclosureFooter } from "@/components/shell/CandidateDisclosureFooter";
import { LabExperience } from "@/features/marketing-home-v2/LabExperience";
import type { LabChapterConfig } from "@/features/marketing-home-v2/lab-types";
import {
    CoachingStage,
    DashboardStage,
    LandingStage,
    QueueStage,
    SessionStage,
    SetupStage,
} from "@/features/marketing-home-v2/LabProductStages";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const CANDIDATE_LOGIN_HREF = "/candidate/login";
export const CANDIDATE_REGISTER_HREF = "/candidate/register";

export const JOB_SEEKER_HREF = "https://talentarbor.com/job-seeker";
export const EMPLOYER_HREF = "https://rangam.com/employers";
export const EMPLOYER_DEMO_HREF = "https://rangam.com/partner-with-rangam?hsLang=en";
export const EMPLOYEE_LOGIN_HREF = "/login";

const chapters: LabChapterConfig[] = [
    {
        id: "prepare",
        label: "Prepare",
        heading: "Start from the interview in front of you.",
        outcome: "Walk in knowing what this interview will ask.",
        beats: [
            {
                id: "setup",
                navLabel: "Set up",
                title: "Tell us what you’re interviewing for",
                body: "Share the role and interview stage. Interview Coach builds a practice set that fits that conversation — not a generic quiz.",
                stage: <SetupStage />,
            },
            {
                id: "landing",
                navLabel: "Get ready",
                title: "See your plan before you begin",
                body: "You’ll get a clear rundown of the questions ahead, then one simple start when you’re ready.",
                stage: <LandingStage />,
            },
        ],
    },
    {
        id: "practice",
        label: "Practice",
        heading: "Strengthen one answer at a time.",
        outcome: "Leave each question with one clear thing to try next.",
        flip: true,
        beats: [
            {
                id: "session",
                navLabel: "Answer",
                title: "Practice the question in front of you",
                body: "Type or speak your answer. If you want help, open tips or an example structure — available when you need them, easy to ignore when you don’t.",
                stage: <SessionStage />,
            },
            {
                id: "coach",
                navLabel: "Review",
                title: "Hear what landed — and what to try next",
                body: "After you submit, coaching points to what’s working and one concrete improvement. No score. No ranking.",
                stage: <CoachingStage />,
            },
        ],
    },
    {
        id: "improve",
        label: "Improve",
        heading: "Carry the coaching into your next practice.",
        outcome: "Turn feedback into the next short round — without starting over.",
        beats: [
            {
                id: "dashboard",
                navLabel: "Come back",
                title: "Come back to a clear next step",
                body: "Your practice home summarizes the latest round and highlights the highest-value thing to work on next.",
                stage: <DashboardStage />,
            },
            {
                id: "queue",
                navLabel: "Practice again",
                title: "Build a short round from what still needs work",
                body: "Pick follow-ups from coaching or gaps in coverage, then jump into another focused practice without starting over.",
                stage: <QueueStage />,
            },
        ],
    },
];

export function MarketingHomePage() {
    return (
        <LabExperience
            chapters={chapters}
            candidateLoginHref={CANDIDATE_LOGIN_HREF}
            candidateRegisterHref={CANDIDATE_REGISTER_HREF}
            jobSeekerHref={JOB_SEEKER_HREF}
            employerHref={EMPLOYER_HREF}
            employeeLoginHref={EMPLOYEE_LOGIN_HREF}
            trust={
                <section id="marketing-trust" className="marketing-trust" aria-labelledby="trust-heading">
                    <div className="marketing-trust__inner">
                        <h2 id="trust-heading">Your practice stays yours.</h2>
                        <p>
                            Candidate-led practice is protected by app access controls. It is for preparation and your
                            own review — not employer hiring decisions.
                        </p>
                        <ul className="marketing-trust__points">
                            <li>Candidate-led practice</li>
                            <li>Protected practice data</li>
                            <li>Not for hiring decisions</li>
                        </ul>
                    </div>
                </section>
            }
            audiences={
                <section className="marketing-audiences" aria-labelledby="audiences-heading">
                    <div className="marketing-audiences__inner">
                        <h2 id="audiences-heading" className="sr-only">
                            Job seekers and employers
                        </h2>
                        <div className="marketing-audiences__grid">
                            <article className="marketing-audience" aria-labelledby="audience-job-seekers">
                                <h2 id="audience-job-seekers">Job seekers</h2>
                                <div className="marketing-audience__block">
                                    <h3>Interview Coach</h3>
                                    <p>
                                        Practice for the interview you’re preparing for — with coaching that stays
                                        private.
                                    </p>
                                    <div className="marketing-audience__actions">
                                        <Link href={CANDIDATE_LOGIN_HREF} className="marketing-btn marketing-btn--ghost">
                                            Sign in
                                        </Link>
                                        <Link
                                            href={CANDIDATE_REGISTER_HREF}
                                            className="marketing-btn marketing-btn--primary"
                                        >
                                            Start practicing
                                        </Link>
                                    </div>
                                </div>
                                <div className="marketing-audience__block">
                                    <h3>Looking for open roles?</h3>
                                    <p>
                                        Explore openings on TalentArbor, then come back here when you’re ready to
                                        prepare.
                                    </p>
                                    <Link href={JOB_SEEKER_HREF} className="marketing-audience__link">
                                        TalentArbor for job seekers
                                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                    </Link>
                                </div>
                            </article>
                            <article className="marketing-audience" aria-labelledby="audience-employers">
                                <h2 id="audience-employers">Employers</h2>
                                <div className="marketing-audience__block">
                                    <h3>Hiring with Rangam</h3>
                                    <p>See how Rangam supports inclusive hiring for teams and staffing partners.</p>
                                    <Link href={EMPLOYER_HREF} className="marketing-audience__link">
                                        Rangam for employers
                                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                    </Link>
                                </div>
                                <div className="marketing-audience__block">
                                    <h3>Request a demo</h3>
                                    <p>
                                        Tell us about your staffing needs and we’ll follow up with a fit for your goals.
                                    </p>
                                    <Link href={EMPLOYER_DEMO_HREF} className="marketing-btn marketing-btn--primary">
                                        Request a demo
                                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                    </Link>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>
            }
            footer={
                <CandidateDisclosureFooter>
                    Interview Coach uses AI to support practice coaching. Practice data is protected by app security and
                    access controls, and is not used to make hiring decisions.
                </CandidateDisclosureFooter>
            }
        />
    );
}
