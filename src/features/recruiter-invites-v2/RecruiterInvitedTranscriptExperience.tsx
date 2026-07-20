import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed, MessageSquareText } from "lucide-react";

import type { RecruiterInvitedTranscriptReadModel } from "./recruiter-invited-transcript-read-model";

export function RecruiterInvitedTranscriptExperience({
    model,
}: {
    model: RecruiterInvitedTranscriptReadModel;
}) {
    return (
        <main className="recruiter-workspace recruiter-transcript-page">
            <Link className="recruiter-transcript-back" href="/recruiter/dashboard">
                <ArrowLeft size={16} aria-hidden="true" /> Back to invitations
            </Link>

            <header className="recruiter-transcript-intro">
                <div>
                    <p className="type-eyebrow">Candidate responses</p>
                    <h1>{model.candidateName}</h1>
                    <p>{model.candidateEmail}</p>
                </div>
                <div className="recruiter-transcript-intro__role">
                    <span>{model.targetRole}</span>
                    <small>{model.interviewStageLabel}</small>
                    {model.requisitionReference ? <small>Req: {model.requisitionReference}</small> : null}
                </div>
            </header>

            <section className="recruiter-transcript-facts" aria-label="Session summary">
                <div>
                    <span>Status</span>
                    <strong>{model.practiceStateLabel}</strong>
                </div>
                <div>
                    <span>Responses</span>
                    <strong>{model.answeredQuestionCount} of {model.questionCount}</strong>
                </div>
                <div>
                    <span>Session attempt</span>
                    <strong>{model.sessionAttemptNumber}</strong>
                </div>
            </section>

            <section className="recruiter-transcript-content" aria-labelledby="recruiter-transcript-title">
                <div className="recruiter-transcript-content__heading">
                    <span aria-hidden="true"><MessageSquareText size={18} /></span>
                    <div>
                        <h2 id="recruiter-transcript-title">Question and answer transcript</h2>
                        <p>Each item shows the candidate&apos;s latest submitted response. Drafts and AI coaching are not included.</p>
                    </div>
                </div>

                <ol className="recruiter-transcript-list">
                    {model.items.map((item) => (
                        <li key={item.slotId}>
                            <article className={item.answerText ? "is-answered" : "is-unanswered"}>
                                <div className="recruiter-transcript-question">
                                    <span>Q{item.number}</span>
                                    <div>
                                        <p className="type-eyebrow">{item.categoryLabel}</p>
                                        <h3>{item.questionText}</h3>
                                    </div>
                                </div>
                                {item.answerText ? (
                                    <div className="recruiter-transcript-answer">
                                        <CheckCircle2 size={17} aria-hidden="true" />
                                        <div>
                                            <p>Submitted response</p>
                                            <blockquote>{item.answerText}</blockquote>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="recruiter-transcript-answer is-empty">
                                        <CircleDashed size={17} aria-hidden="true" />
                                        <p>No answer submitted.</p>
                                    </div>
                                )}
                            </article>
                        </li>
                    ))}
                </ol>
            </section>
        </main>
    );
}
