"use client";

import { PhoneFrame } from "./PhoneFrame";
import { SessionMobileAStage } from "./SessionMobileAStage";

export function SetupStage() {
    return (
        <PhoneFrame>
            <div className="lab-screen lab-screen--setup">
                <p className="lab-screen__eyebrow">New prep</p>
                <h3>What are you interviewing for?</h3>
                <label className="lab-field">
                    <span>Target role</span>
                    <span className="lab-field__value">Senior Product Designer</span>
                </label>
                <label className="lab-field">
                    <span>Interview stage</span>
                    <span className="lab-field__value">First interview</span>
                </label>
                <label className="lab-field">
                    <span>Round size</span>
                    <span className="lab-field__value">7 questions · recommended</span>
                </label>
                <div className="lab-screen__cta">Build my first round</div>
            </div>
        </PhoneFrame>
    );
}

export function LandingStage() {
    return (
        <PhoneFrame>
            <div className="lab-screen lab-screen--landing">
                <div className="lab-spotlight">
                    <p>First interview</p>
                    <h3>Senior Product Designer</h3>
                    <span>Your practice is ready. I’ll help you see what’s working after each answer.</span>
                    <div className="lab-spotlight__stats">
                        <div>
                            <small>Questions</small>
                            <strong>7</strong>
                        </div>
                        <div>
                            <small>Time</small>
                            <strong>~25 min</strong>
                        </div>
                        <div>
                            <small>Resume</small>
                            <strong>Included</strong>
                        </div>
                    </div>
                </div>
                <p className="lab-screen__eyebrow">Question plan</p>
                <ul className="lab-plan">
                    <li>
                        <span>01</span>
                        <div>
                            <small>Behavioral</small>
                            <p>Tell me about a hard tradeoff you owned.</p>
                        </div>
                    </li>
                    <li>
                        <span>02</span>
                        <div>
                            <small>Scenario</small>
                            <p>A stakeholder changes scope mid-sprint. What do you do?</p>
                        </div>
                    </li>
                </ul>
                <div className="lab-screen__cta">Start practice</div>
            </div>
        </PhoneFrame>
    );
}

/** Ch 2a — Session Mobile A screen content inside the shared lab viewport. */
export function SessionStage() {
    return (
        <PhoneFrame>
            <SessionMobileAStage />
        </PhoneFrame>
    );
}

export function CoachingStage() {
    return (
        <PhoneFrame>
            <div className="lab-screen lab-screen--coach">
                <p className="lab-screen__eyebrow">What I noticed</p>
                <h3>Clear decision under pressure</h3>
                <p>
                    You named the tradeoff and the result. Next, add one sentence on how you kept stakeholders aligned
                    while the launch slipped.
                </p>
                <div className="lab-coach-actions">
                    <span className="lab-screen__cta">Try a revision</span>
                    <span className="lab-chip">Continue</span>
                </div>
            </div>
        </PhoneFrame>
    );
}

export function DashboardStage() {
    return (
        <PhoneFrame>
            <div className="lab-screen lab-screen--dash">
                <p className="lab-screen__eyebrow">Practice home</p>
                <h3>Senior Product Designer</h3>
                <p className="lab-muted">Review what I noticed, then choose what to work on next.</p>
                <div className="lab-spotlight">
                    <p>Latest round feedback</p>
                    <h3>You’re trending up on specificity</h3>
                    <span>Your last answers led with concrete examples. Add clearer outcomes next.</span>
                    <div className="lab-screen__cta lab-screen__cta--light">Open update</div>
                </div>
                <div className="lab-next">
                    <p className="lab-screen__eyebrow">Practice next</p>
                    <strong>Finish planned coverage</strong>
                    <span>2 questions still need evidence</span>
                </div>
            </div>
        </PhoneFrame>
    );
}

export function QueueStage() {
    return (
        <PhoneFrame>
            <div className="lab-screen lab-screen--queue">
                <p className="lab-screen__eyebrow">Next practice round</p>
                <h3>2 queued</h3>
                <ul className="lab-queue">
                    <li>
                        <strong>Q3 · Behavioral</strong>
                        <span>From feedback · add outcomes</span>
                    </li>
                    <li>
                        <strong>Q6 · Scenario</strong>
                        <span>Missing coverage</span>
                    </li>
                </ul>
                <div className="lab-screen__cta">Start practice</div>
            </div>
        </PhoneFrame>
    );
}
