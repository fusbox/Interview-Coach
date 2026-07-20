import Link from "next/link";
import { AlertCircle, ArrowRight, Clock3, MailCheck, PlayCircle, UserCheck, Users } from "lucide-react";

import type {
    RecruiterDashboardDeliveryState,
    RecruiterDashboardEntryState,
    RecruiterDashboardPracticeState,
    RecruiterDashboardReadModel,
    RecruiterDashboardRecipient,
} from "./recruiter-dashboard-read-model";

export function RecruiterDashboardExperience({ model }: { model: RecruiterDashboardReadModel }) {
    const summaryItems = [
        { label: "Invitations", value: model.summary.totalInvitations, icon: Users },
        { label: "Not started", value: model.summary.notStarted, icon: Clock3 },
        { label: "In practice", value: model.summary.inPractice, icon: PlayCircle },
        { label: "Completed", value: model.summary.completed, icon: UserCheck },
        { label: "Needs attention", value: model.summary.needsAttention, icon: AlertCircle },
    ];

    return (
        <main className="recruiter-workspace recruiter-dashboard-page">
            <header className="recruiter-dashboard-intro">
                <div>
                    <p className="type-eyebrow">Recruiter workspace</p>
                    <h1>Invitations</h1>
                    <p>Track delivery, entry, and practice progress for the candidates you invited.</p>
                </div>
                <Link className="recruiter-dashboard-create-link" href="/recruiter/create">
                    Create invitations <ArrowRight size={17} aria-hidden="true" />
                </Link>
            </header>

            <section className="recruiter-dashboard-summary" aria-label="Invitation summary">
                {summaryItems.map(({ label, value, icon: Icon }) => (
                    <article key={label} className={label === "Needs attention" && value > 0 ? "is-attention" : undefined}>
                        <span aria-hidden="true"><Icon size={17} /></span>
                        <div>
                            <p>{label}</p>
                            <strong>{value}</strong>
                        </div>
                    </article>
                ))}
            </section>

            <section className="recruiter-dashboard-activity" aria-labelledby="recruiter-dashboard-activity-title">
                <div className="recruiter-dashboard-activity__heading">
                    <div>
                        <p className="type-eyebrow">Invitation activity</p>
                        <h2 id="recruiter-dashboard-activity-title">Candidate progress</h2>
                    </div>
                    <p>{model.recipients.length} {model.recipients.length === 1 ? "candidate" : "candidates"}</p>
                </div>

                {model.recipients.length === 0 ? (
                    <div className="recruiter-dashboard-empty">
                        <span aria-hidden="true"><MailCheck size={22} /></span>
                        <h3>No invitations yet</h3>
                        <p>Create an invitation to begin tracking candidate entry and practice progress.</p>
                        <Link className="recruiter-dashboard-create-link" href="/recruiter/create">
                            Create invitations <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                    </div>
                ) : (
                    <div className="recruiter-dashboard-table" role="table" aria-label="Recruiter invitation activity">
                        <div className="recruiter-dashboard-table__header" role="row">
                            <span role="columnheader">Candidate</span>
                            <span role="columnheader">Role</span>
                            <span role="columnheader">Practice</span>
                            <span role="columnheader">Entry</span>
                            <span role="columnheader">Email</span>
                            <span role="columnheader">Last activity</span>
                        </div>
                        <div role="rowgroup">
                            {model.recipients.map((recipient) => (
                                <RecipientRow key={recipient.recipientId} recipient={recipient} />
                            ))}
                        </div>
                    </div>
                )}

                {model.recipients.length > 0 ? (
                    <p className="recruiter-dashboard-provider-note">
                        Email accepted means the configured provider accepted the message. It does not confirm mailbox delivery.
                    </p>
                ) : null}
            </section>
        </main>
    );
}

function RecipientRow({ recipient }: { recipient: RecruiterDashboardRecipient }) {
    return (
        <div className={recipient.needsAttention ? "recruiter-dashboard-table__row is-attention" : "recruiter-dashboard-table__row"} role="row">
            <div className="recruiter-dashboard-table__candidate" role="cell">
                <span className="recruiter-dashboard-table__mobile-label">Candidate</span>
                <strong>{recipient.candidateName}</strong>
                <span>{recipient.email}</span>
                {recipient.requisitionReference ? <small>Req: {recipient.requisitionReference}</small> : null}
            </div>
            <div role="cell">
                <span className="recruiter-dashboard-table__mobile-label">Role</span>
                <strong>{recipient.targetRole}</strong>
                <span>{recipient.interviewStageLabel}</span>
            </div>
            <div role="cell">
                <span className="recruiter-dashboard-table__mobile-label">Practice</span>
                <StatusPill kind={practiceTone(recipient.practiceState)}>{practiceLabel(recipient.practiceState)}</StatusPill>
                <span>{recipient.answeredQuestionCount} of {recipient.questionCount} answered</span>
                {recipient.sessionAttemptNumber > 1 ? <small>Session attempt {recipient.sessionAttemptNumber}</small> : null}
                <Link className="recruiter-dashboard-response-link" href={`/recruiter/sessions/${recipient.sessionId}`}>
                    View responses <ArrowRight size={14} aria-hidden="true" />
                </Link>
            </div>
            <div role="cell">
                <span className="recruiter-dashboard-table__mobile-label">Entry</span>
                <StatusPill kind={entryTone(recipient.entryState)}>{entryLabel(recipient.entryState)}</StatusPill>
            </div>
            <div role="cell">
                <span className="recruiter-dashboard-table__mobile-label">Email</span>
                <StatusPill kind={deliveryTone(recipient.deliveryState)}>{deliveryLabel(recipient.deliveryState)}</StatusPill>
                {recipient.deliveryAttemptNumber && recipient.deliveryAttemptNumber > 1
                    ? <small>Attempt {recipient.deliveryAttemptNumber}</small>
                    : null}
                <Link className="recruiter-dashboard-response-link" href={`/recruiter/invitations/${recipient.batchId}`}>
                    Invitation details <ArrowRight size={14} aria-hidden="true" />
                </Link>
            </div>
            <div role="cell">
                <span className="recruiter-dashboard-table__mobile-label">Last activity</span>
                <time dateTime={recipient.lastActivityAt}>{formatUtcTimestamp(recipient.lastActivityAt)}</time>
                {recipient.completedAt ? <small>Completed {formatUtcTimestamp(recipient.completedAt)}</small> : null}
            </div>
        </div>
    );
}

function StatusPill({ children, kind }: { children: string; kind: "muted" | "active" | "positive" | "attention" }) {
    return <span className={`recruiter-dashboard-status is-${kind}`}>{children}</span>;
}

function practiceLabel(state: RecruiterDashboardPracticeState) {
    return {
        not_started: "Not started",
        in_progress: "In practice",
        completed: "Complete",
        abandoned: "Closed",
        revoked: "Revoked",
    }[state];
}

function practiceTone(state: RecruiterDashboardPracticeState): "muted" | "active" | "positive" | "attention" {
    if (state === "completed") return "positive";
    if (state === "in_progress") return "active";
    return "muted";
}

function entryLabel(state: RecruiterDashboardEntryState) {
    return {
        not_opened: "Not opened",
        opened: "Link opened",
        initials_match: "Initials match",
        initials_mismatch: "Initials mismatch",
    }[state];
}

function entryTone(state: RecruiterDashboardEntryState): "muted" | "active" | "positive" | "attention" {
    if (state === "initials_match") return "positive";
    if (state === "initials_mismatch") return "attention";
    if (state === "opened") return "active";
    return "muted";
}

function deliveryLabel(state: RecruiterDashboardDeliveryState) {
    return {
        not_requested: "Not emailed",
        queued: "Email queued",
        sending: "Sending",
        provider_accepted: "Email accepted",
        failed_retryable: "Email failed",
        failed_terminal: "Email failed",
        outcome_unknown: "Email unknown",
    }[state];
}

function deliveryTone(state: RecruiterDashboardDeliveryState): "muted" | "active" | "positive" | "attention" {
    if (state === "provider_accepted") return "positive";
    if (state === "queued" || state === "sending") return "active";
    if (state === "failed_retryable" || state === "failed_terminal" || state === "outcome_unknown") return "attention";
    return "muted";
}

function formatUtcTimestamp(value: string) {
    return `${new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
    }).format(new Date(value))} UTC`;
}
