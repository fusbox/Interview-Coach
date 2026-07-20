"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Check,
    Clipboard,
    Copy,
    Loader2,
    Mail,
    ShieldCheck,
    Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
    RecruiterInvitationHandoffDeliveryState,
    RecruiterInvitationHandoffReadModel,
    RecruiterInvitationHandoffRecipient,
} from "./recruiter-invitation-handoff-read-model";

type DeliveryResponseRecipient = {
    recipientId: string;
    status: "provider_accepted" | "failed" | "in_progress" | "outcome_unknown" | "not_retryable";
    retryable: boolean;
};

export function RecruiterInvitationHandoffExperience({ model }: { model: RecruiterInvitationHandoffReadModel }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [actionKey, setActionKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [copiedItem, setCopiedItem] = useState<{ recipientId: string; kind: "link" | "message" } | null>(null);
    const [deliveryOverrides, setDeliveryOverrides] = useState<Record<string, RecruiterInvitationHandoffDeliveryState>>({});
    const eligibleCount = model.sendEligibleCount + model.retryEligibleCount;
    const actionLabel = model.sendEligibleCount > 0
        ? "Send pending invitations"
        : "Retry failed delivery";

    async function copyText(recipient: RecruiterInvitationHandoffRecipient, kind: "link" | "message") {
        const value = kind === "link" ? recipient.inviteLink : recipient.copyMessage;
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedItem({ recipientId: recipient.recipientId, kind });
            setError(null);
        } catch {
            setError(kind === "link"
                ? "The invitation link could not be copied. Select the link and copy it manually."
                : "The invitation message could not be copied. Try copying the link instead.");
        }
    }

    async function processDelivery() {
        if (eligibleCount === 0 || busy) return;
        const currentActionKey = actionKey ?? createBrowserActionKey();
        setActionKey(currentActionKey);
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/recruiter/invitations/delivery", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ batchId: model.batchId, actionKey: currentActionKey }),
            });
            const body = await readJson(response);
            if (!response.ok || body.status !== "delivery_processed") {
                throw new Error(readMessage(body, "Invitation delivery is temporarily unavailable."));
            }
            const recipients = Array.isArray(body.recipients)
                ? body.recipients.filter(isDeliveryResponseRecipient)
                : [];
            setDeliveryOverrides(Object.fromEntries(recipients.map((recipient) => [
                recipient.recipientId,
                toDeliveryState(recipient),
            ])));
            setNotice("Delivery states were updated from the invitation ledger.");
            setActionKey(null);
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Invitation delivery is temporarily unavailable.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="recruiter-workspace recruiter-handoff-page">
            <header className="recruiter-handoff-intro">
                <Link className="recruiter-handoff-back" href="/recruiter/dashboard">
                    <ArrowLeft size={16} aria-hidden="true" /> Back to invitations
                </Link>
                <div className="recruiter-handoff-intro__body">
                    <div>
                        <p className="type-eyebrow">Invitation handoff</p>
                        <h1>{model.targetRole}</h1>
                        <p>Recover the candidate links and the latest delivery state for this invitation batch.</p>
                    </div>
                    {eligibleCount > 0 && model.lifecycleState === "ready" ? (
                        <Button
                            type="button"
                            emphasis="primary"
                            density="comfortable"
                            shape="app"
                            label="strong"
                            disabled={busy}
                            onClick={processDelivery}
                        >
                            {busy ? <Loader2 className="recruiter-spin" size={17} /> : <Mail size={17} />}
                            {busy ? "Processing delivery" : actionLabel}
                        </Button>
                    ) : null}
                </div>
            </header>

            <section className="recruiter-handoff-summary" aria-label="Invitation batch summary">
                <div><span>Stage</span><strong>{model.interviewStageLabel}</strong></div>
                <div><span>Candidates</span><strong>{model.recipientCount}</strong></div>
                <div><span>Created</span><strong>{formatUtcTimestamp(model.createdAt)}</strong></div>
                <div><span>Batch state</span><strong>{model.lifecycleState === "ready" ? "Active" : "Revoked"}</strong></div>
            </section>

            {error ? <p className="recruiter-handoff-alert is-error"><AlertCircle size={17} aria-hidden="true" />{error}</p> : null}
            {notice ? <p className="recruiter-handoff-alert is-success"><Check size={17} aria-hidden="true" />{notice}</p> : null}

            <section className="recruiter-handoff-recipients" aria-labelledby="recruiter-handoff-recipients-title">
                <div className="recruiter-handoff-recipients__heading">
                    <div>
                        <p className="type-eyebrow">Candidates</p>
                        <h2 id="recruiter-handoff-recipients-title">Invitation details</h2>
                    </div>
                    <span><Users size={16} aria-hidden="true" /> {model.recipientCount} {model.recipientCount === 1 ? "recipient" : "recipients"}</span>
                </div>

                <div className="recruiter-handoff-list">
                    {model.recipients.map((recipient) => {
                        const deliveryState = deliveryOverrides[recipient.recipientId] ?? recipient.deliveryState;
                        return (
                            <article key={recipient.recipientId} className="recruiter-handoff-recipient">
                                <div className="recruiter-handoff-recipient__identity">
                                    <div>
                                        <strong>{recipient.candidateName}</strong>
                                        <span>{recipient.email}</span>
                                        {recipient.requisitionReference ? <small>Req: {recipient.requisitionReference}</small> : null}
                                    </div>
                                    <DeliveryStatus state={deliveryState} label={overrideDeliveryLabel(deliveryState, recipient.deliveryLabel)} />
                                </div>

                                <div className="recruiter-handoff-recipient__facts">
                                    <div><span>Practice</span><strong>{recipient.sessionStateLabel}</strong></div>
                                    <div><span>Session attempt</span><strong>{recipient.sessionAttemptNumber}</strong></div>
                                    <div><span>Email attempt</span><strong>{recipient.deliveryAttemptNumber ?? "Not started"}</strong></div>
                                </div>

                                <p className="recruiter-handoff-recipient__detail">{recipient.deliveryDetail}</p>

                                {recipient.inviteLink ? (
                                    <div className="recruiter-handoff-copy">
                                        <label>
                                            <span>Personal invitation link</span>
                                            <input aria-label={`Invitation link for ${recipient.candidateName}`} readOnly value={recipient.inviteLink} />
                                        </label>
                                        <div>
                                            <Button type="button" emphasis="secondary" density="compact" shape="app" label="strong" onClick={() => copyText(recipient, "link")}>
                                                {copiedItem?.recipientId === recipient.recipientId && copiedItem.kind === "link" ? <Check size={16} /> : <Clipboard size={16} />}
                                                {copiedItem?.recipientId === recipient.recipientId && copiedItem.kind === "link" ? "Copied" : "Copy link"}
                                            </Button>
                                            <Button type="button" emphasis="secondary" density="compact" shape="app" label="strong" onClick={() => copyText(recipient, "message")}>
                                                {copiedItem?.recipientId === recipient.recipientId && copiedItem.kind === "message" ? <Check size={16} /> : <Copy size={16} />}
                                                {copiedItem?.recipientId === recipient.recipientId && copiedItem.kind === "message" ? "Copied" : "Copy message"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="recruiter-handoff-link-unavailable">
                                        <ShieldCheck size={17} aria-hidden="true" /> {linkUnavailableLabel(recipient.linkAvailability)}
                                    </p>
                                )}

                                <Link className="recruiter-dashboard-response-link" href={`/recruiter/sessions/${recipient.sessionId}`}>
                                    View responses <ArrowRight size={14} aria-hidden="true" />
                                </Link>
                            </article>
                        );
                    })}
                </div>
            </section>

            <p className="recruiter-handoff-provider-note">
                Email accepted means the configured provider accepted the message. It does not confirm mailbox delivery.
            </p>
            <p className="sr-only" aria-live="polite">{busy ? "Processing invitation delivery" : notice ?? error ?? ""}</p>
        </main>
    );
}

function DeliveryStatus({ state, label }: { state: RecruiterInvitationHandoffDeliveryState; label: string }) {
    const tone = state === "provider_accepted"
        ? "positive"
        : state === "queued" || state === "sending"
            ? "active"
            : state === "failed_retryable" || state === "failed_terminal" || state === "outcome_unknown"
                ? "attention"
                : "muted";
    return <span className={`recruiter-dashboard-status is-${tone}`}>{label}</span>;
}

function overrideDeliveryLabel(state: RecruiterInvitationHandoffDeliveryState, original: string) {
    return {
        not_requested: original,
        queued: "Email queued",
        sending: "Delivery in progress",
        provider_accepted: "Accepted by email provider",
        failed_retryable: "Email failed - retry available",
        failed_terminal: "Email could not be retried",
        outcome_unknown: "Delivery outcome needs review",
    }[state];
}

function linkUnavailableLabel(availability: RecruiterInvitationHandoffRecipient["linkAvailability"]) {
    return {
        active: "Invitation link available.",
        expired: "This personal invitation link has expired.",
        revoked: "This personal invitation link has been revoked.",
        unavailable: "This personal invitation link is unavailable.",
    }[availability];
}

function toDeliveryState(recipient: DeliveryResponseRecipient): RecruiterInvitationHandoffDeliveryState {
    if (recipient.status === "provider_accepted") return "provider_accepted";
    if (recipient.status === "in_progress") return "sending";
    if (recipient.status === "outcome_unknown") return "outcome_unknown";
    if (recipient.status === "failed") return recipient.retryable ? "failed_retryable" : "failed_terminal";
    return "failed_terminal";
}

function isDeliveryResponseRecipient(value: unknown): value is DeliveryResponseRecipient {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const recipient = value as Record<string, unknown>;
    return typeof recipient.recipientId === "string"
        && (recipient.status === "provider_accepted"
            || recipient.status === "failed"
            || recipient.status === "in_progress"
            || recipient.status === "outcome_unknown"
            || recipient.status === "not_retryable")
        && typeof recipient.retryable === "boolean";
}

function createBrowserActionKey() {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
    return `recruiter-delivery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    const value = await response.json().catch(() => ({}));
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function readMessage(body: Record<string, unknown>, fallback: string) {
    return typeof body.message === "string" && body.message.trim() ? body.message : fallback;
}

function formatUtcTimestamp(value: string) {
    return `${new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(value))} UTC`;
}
