"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Clipboard,
    Copy,
    Mail,
    Loader2,
    Plus,
    RotateCcw,
    Sparkles,
    Trash2,
    Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { candidateSetupStageOptions, type CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import { getCandidateStageBaselineQuestionCount } from "@/features/candidate-setup-v2/candidate-practice-plan-baseline";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";

type PreparedQuestion = {
    slotId: string;
    index: number;
    category: string;
    label: string;
    questionText: string;
};

type PreparedQuestionSet = {
    questionSetId: string;
    source: "generated" | "manual";
    targetRole: string;
    interviewStage: CandidateSetupStageId;
    questionCount: number;
    questions: PreparedQuestion[];
};

type RecipientDraft = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    requisitionReference: string;
    resumeText: string;
};

type InvitationResult = {
    recipientId: string;
    sessionId: string;
    firstName: string;
    lastName: string;
    email: string;
    inviteLink: string;
    copyMessage: string;
    tokenExpiresAt: string;
};

type DeliveryResult = {
    recipientId: string;
    attemptId: string | null;
    attemptNumber: number | null;
    status: "provider_accepted" | "failed" | "in_progress" | "outcome_unknown" | "not_retryable";
    retryable: boolean;
    failureCode: string | null;
};

type Phase = "questions" | "recipients" | "review" | "complete";

export function RecruiterInvitationCreateExperience() {
    const [phase, setPhase] = useState<Phase>("questions");
    const [targetRole, setTargetRole] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [interviewStage, setInterviewStage] = useState<CandidateSetupStageId>("screening");
    const [questionTexts, setQuestionTexts] = useState(() => emptyQuestions("screening"));
    const [actionKey, setActionKey] = useState(createBrowserActionKey);
    const [preparedQuestionSet, setPreparedQuestionSet] = useState<PreparedQuestionSet | null>(null);
    const [recipients, setRecipients] = useState<RecipientDraft[]>([createRecipientDraft()]);
    const [invitations, setInvitations] = useState<InvitationResult[]>([]);
    const [createdBatchId, setCreatedBatchId] = useState<string | null>(null);
    const [deliveryResults, setDeliveryResults] = useState<Record<string, DeliveryResult>>({});
    const [deliveryActionKey, setDeliveryActionKey] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState<"generate" | "manual" | "create" | "deliver" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedItem, setCopiedItem] = useState<{ recipientId: string; kind: "link" | "message" } | null>(null);

    const questionPlan = useMemo(() => createCandidateQuestionPlan({
        interviewStage,
        questionCount: getCandidateStageBaselineQuestionCount(interviewStage),
    }), [interviewStage]);

    function changeStage(stage: CandidateSetupStageId) {
        setInterviewStage(stage);
        setQuestionTexts(emptyQuestions(stage));
        setError(null);
    }

    async function prepareQuestions(source: "generated" | "manual") {
        setBusyAction(source === "generated" ? "generate" : "manual");
        setError(null);
        try {
            const response = await fetch("/api/recruiter/invitations", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    operation: "prepare_questions",
                    actionKey,
                    source,
                    targetRole,
                    jobDescription,
                    interviewStage,
                    ...(source === "manual" ? { questions: questionTexts } : {}),
                }),
            });
            const body = await readJson(response);
            if (!response.ok || body.status !== "questions_ready") {
                throw new Error(readMessage(body, "Questions could not be prepared."));
            }
            const ready = body as PreparedQuestionSet & { status: "questions_ready" };
            setPreparedQuestionSet({
                questionSetId: ready.questionSetId,
                source: ready.source,
                targetRole: ready.targetRole,
                interviewStage: ready.interviewStage,
                questionCount: ready.questionCount,
                questions: ready.questions,
            });
            setQuestionTexts(ready.questions.map((question) => question.questionText));
            setPhase("recipients");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Questions could not be prepared.");
        } finally {
            setBusyAction(null);
        }
    }

    function startOver() {
        setPreparedQuestionSet(null);
        setQuestionTexts(emptyQuestions(interviewStage));
        setActionKey(createBrowserActionKey());
        setPhase("questions");
        setError(null);
    }

    function updateRecipient(id: string, field: keyof Omit<RecipientDraft, "id">, value: string) {
        setRecipients((current) => current.map((recipient) => (
            recipient.id === id ? { ...recipient, [field]: value } : recipient
        )));
    }

    function addRecipient() {
        if (recipients.length >= 100) return;
        setRecipients((current) => [...current, createRecipientDraft()]);
    }

    function removeRecipient(id: string) {
        setRecipients((current) => current.length === 1
            ? current
            : current.filter((recipient) => recipient.id !== id));
    }

    function reviewRecipients(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setPhase("review");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function createInvitations() {
        if (!preparedQuestionSet) return;
        setBusyAction("create");
        setError(null);
        try {
            const response = await fetch("/api/recruiter/invitations", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    operation: "create_invitations",
                    actionKey,
                    questionSetId: preparedQuestionSet.questionSetId,
                    recipients: recipients.map(toRecipientInput),
                }),
            });
            const body = await readJson(response);
            if (!response.ok || body.status !== "invitations_created") {
                throw new Error(readMessage(body, "Invitations could not be created."));
            }
            setInvitations(Array.isArray(body.recipients) ? body.recipients as InvitationResult[] : []);
            setCreatedBatchId(typeof body.batchId === "string" ? body.batchId : null);
            setPhase("complete");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Invitations could not be created.");
        } finally {
            setBusyAction(null);
        }
    }

    async function copyInviteLink(invitation: InvitationResult) {
        try {
            await navigator.clipboard.writeText(invitation.inviteLink);
            setCopiedItem({ recipientId: invitation.recipientId, kind: "link" });
        } catch {
            setError("The invite link could not be copied. Select the link and copy it manually.");
        }
    }

    async function copyInvitationMessage(invitation: InvitationResult) {
        try {
            await navigator.clipboard.writeText(invitation.copyMessage);
            setCopiedItem({ recipientId: invitation.recipientId, kind: "message" });
        } catch {
            setError("The invitation message could not be copied. Try copying the link instead.");
        }
    }

    async function deliverInvitations() {
        if (!createdBatchId) return;
        const currentActionKey = deliveryActionKey ?? createBrowserActionKey();
        setDeliveryActionKey(currentActionKey);
        setBusyAction("deliver");
        setError(null);
        try {
            const response = await fetch("/api/recruiter/invitations/delivery", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ batchId: createdBatchId, actionKey: currentActionKey }),
            });
            const body = await readJson(response);
            if (!response.ok || body.status !== "delivery_processed") {
                throw new Error(readMessage(body, "Invitation delivery could not be processed."));
            }
            const results = Array.isArray(body.recipients) ? body.recipients as DeliveryResult[] : [];
            setDeliveryResults(Object.fromEntries(results.map((result) => [result.recipientId, result])));
            setDeliveryActionKey(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Invitation delivery could not be processed.");
        } finally {
            setBusyAction(null);
        }
    }

    const deliveryValues = Object.values(deliveryResults);
    const allProviderAccepted = invitations.length > 0
        && invitations.every((invitation) => deliveryResults[invitation.recipientId]?.status === "provider_accepted");
    const hasRetryableFailure = deliveryValues.some((result) => result.status === "failed" && result.retryable);
    const hasDeliverableRecipient = invitations.some((invitation) => {
        const result = deliveryResults[invitation.recipientId];
        return !result || (result.status === "failed" && result.retryable);
    });

    return (
        <main className="recruiter-workspace recruiter-create-page">
            <header className="recruiter-create-intro">
                <div>
                    <p className="type-eyebrow">Recruiter invitations</p>
                    <h1>Create a practice invitation</h1>
                    <p>Set the interview context, confirm the questions, then add candidates.</p>
                </div>
                <ol className="recruiter-create-progress" aria-label="Invitation progress">
                    {(["Questions", "Candidates", "Review"] as const).map((label, index) => {
                        const activeIndex = phase === "questions" ? 0 : phase === "recipients" ? 1 : 2;
                        const complete = phase === "complete" || index < activeIndex;
                        return (
                            <li key={label} className={index === activeIndex && phase !== "complete" ? "is-current" : complete ? "is-complete" : ""}>
                                <span>{complete ? <Check size={14} /> : index + 1}</span>
                                {label}
                            </li>
                        );
                    })}
                </ol>
            </header>

            {error ? <div className="recruiter-create-error" role="alert">{error}</div> : null}

            {phase !== "complete" ? (
                <section className="recruiter-create-section" aria-labelledby="question-context-title">
                    <div className="recruiter-create-section__heading">
                        <div>
                            <p className="type-eyebrow">Interview context</p>
                            <h2 id="question-context-title">Questions</h2>
                        </div>
                        {preparedQuestionSet ? (
                            <Button type="button" emphasis="secondary" density="compact" shape="app" label="strong" onClick={startOver}>
                                <RotateCcw size={16} />
                                Start over
                            </Button>
                        ) : null}
                    </div>

                    <div className="recruiter-create-context-grid">
                        <label className="recruiter-create-field">
                            <span>Target role *</span>
                            <input
                                value={targetRole}
                                onChange={(event) => setTargetRole(event.target.value)}
                                required
                                maxLength={120}
                                disabled={Boolean(preparedQuestionSet)}
                            />
                        </label>
                        <label className="recruiter-create-field recruiter-create-field--wide">
                            <span>Job description *</span>
                            <textarea
                                value={jobDescription}
                                onChange={(event) => setJobDescription(event.target.value)}
                                required
                                maxLength={12_000}
                                rows={5}
                                disabled={Boolean(preparedQuestionSet)}
                            />
                        </label>
                        <fieldset className="recruiter-create-stage" disabled={Boolean(preparedQuestionSet)}>
                            <legend>Interview stage *</legend>
                            <div>
                                {candidateSetupStageOptions.map((stage) => (
                                    <button
                                        key={stage.id}
                                        type="button"
                                        className={interviewStage === stage.id ? "is-selected" : ""}
                                        aria-label={`${stage.label}, ${getCandidateStageBaselineQuestionCount(stage.id)} questions`}
                                        aria-pressed={interviewStage === stage.id}
                                        onClick={() => changeStage(stage.id)}
                                    >
                                        <span>{stage.label}</span>
                                        <small>{getCandidateStageBaselineQuestionCount(stage.id)} questions</small>
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    </div>

                    <div className="recruiter-question-block">
                        <div className="recruiter-question-block__header">
                            <div>
                                <h3>{questionPlan.questionCount} fixed question slots</h3>
                                <p>{preparedQuestionSet ? `${preparedQuestionSet.source === "generated" ? "Generated" : "Manual"} set accepted` : "Complete every slot or generate the full set."}</p>
                            </div>
                            {!preparedQuestionSet ? (
                                <Button
                                    type="button"
                                    emphasis="secondary"
                                    density="comfortable"
                                    shape="app"
                                    label="strong"
                                    disabled={!targetRole.trim() || !jobDescription.trim() || busyAction !== null}
                                    onClick={() => prepareQuestions("generated")}
                                >
                                    {busyAction === "generate" ? <Loader2 className="recruiter-spin" size={17} /> : <Sparkles size={17} />}
                                    {busyAction === "generate" ? "Generating" : "Generate questions"}
                                </Button>
                            ) : null}
                        </div>

                        <div className="recruiter-question-list">
                            {questionPlan.slots.map((slot, index) => (
                                <label key={slot.id} className="recruiter-question-field">
                                    <span><strong>Q{index + 1}</strong> {slot.label}</span>
                                    <textarea
                                        value={questionTexts[index] ?? ""}
                                        onChange={(event) => setQuestionTexts((current) => current.map((text, questionIndex) => (
                                            questionIndex === index ? event.target.value : text
                                        )))}
                                        readOnly={Boolean(preparedQuestionSet)}
                                        required
                                        minLength={8}
                                        maxLength={500}
                                        rows={3}
                                    />
                                </label>
                            ))}
                        </div>

                        {!preparedQuestionSet ? (
                            <div className="recruiter-create-actions">
                                <Button
                                    type="button"
                                    emphasis="primary"
                                    density="comfortable"
                                    shape="app"
                                    label="strong"
                                    disabled={
                                        busyAction !== null
                                        || !targetRole.trim()
                                        || !jobDescription.trim()
                                        || questionTexts.some((question) => question.trim().length < 8)
                                    }
                                    onClick={() => prepareQuestions("manual")}
                                >
                                    {busyAction === "manual" ? <Loader2 className="recruiter-spin" size={17} /> : <Check size={17} />}
                                    {busyAction === "manual" ? "Saving questions" : "Use these questions"}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </section>
            ) : null}

            {phase === "recipients" ? (
                <form className="recruiter-create-section" onSubmit={reviewRecipients}>
                    <div className="recruiter-create-section__heading">
                        <div>
                            <p className="type-eyebrow">Invitation recipients</p>
                            <h2>Candidates</h2>
                        </div>
                        <span className="recruiter-recipient-count"><Users size={16} /> {recipients.length}</span>
                    </div>

                    <div className="recruiter-recipient-list">
                        {recipients.map((recipient, index) => (
                            <article key={recipient.id} className="recruiter-recipient-card">
                                <div className="recruiter-recipient-card__heading">
                                    <h3>Candidate {index + 1}</h3>
                                    <button
                                        type="button"
                                        aria-label={`Remove candidate ${index + 1}`}
                                        title="Remove candidate"
                                        disabled={recipients.length === 1}
                                        onClick={() => removeRecipient(recipient.id)}
                                    >
                                        <Trash2 size={17} />
                                    </button>
                                </div>
                                <div className="recruiter-recipient-fields">
                                    <label className="recruiter-create-field">
                                        <span>First name *</span>
                                        <input required maxLength={120} value={recipient.firstName} onChange={(event) => updateRecipient(recipient.id, "firstName", event.target.value)} />
                                    </label>
                                    <label className="recruiter-create-field">
                                        <span>Last name *</span>
                                        <input required maxLength={120} value={recipient.lastName} onChange={(event) => updateRecipient(recipient.id, "lastName", event.target.value)} />
                                    </label>
                                    <label className="recruiter-create-field">
                                        <span>Email *</span>
                                        <input required type="email" maxLength={320} value={recipient.email} onChange={(event) => updateRecipient(recipient.id, "email", event.target.value)} />
                                    </label>
                                    <label className="recruiter-create-field">
                                        <span>Requisition reference</span>
                                        <input maxLength={160} value={recipient.requisitionReference} onChange={(event) => updateRecipient(recipient.id, "requisitionReference", event.target.value)} />
                                    </label>
                                    <label className="recruiter-create-field recruiter-create-field--wide">
                                        <span>Resume text</span>
                                        <textarea rows={4} maxLength={24_000} value={recipient.resumeText} onChange={(event) => updateRecipient(recipient.id, "resumeText", event.target.value)} />
                                    </label>
                                </div>
                            </article>
                        ))}
                    </div>

                    <div className="recruiter-create-actions recruiter-create-actions--split">
                        <Button type="button" emphasis="secondary" density="comfortable" shape="app" label="strong" onClick={addRecipient} disabled={recipients.length >= 100}>
                            <Plus size={17} /> Add candidate
                        </Button>
                        <Button type="submit" emphasis="primary" density="comfortable" shape="app" label="strong">
                            Review invitations
                        </Button>
                    </div>
                </form>
            ) : null}

            {phase === "review" && preparedQuestionSet ? (
                <section className="recruiter-create-section recruiter-invitation-review">
                    <div className="recruiter-create-section__heading">
                        <div>
                            <p className="type-eyebrow">Review</p>
                            <h2>{targetRole}</h2>
                        </div>
                        <span>{preparedQuestionSet.questionCount} questions - {recipients.length} candidate{recipients.length === 1 ? "" : "s"}</span>
                    </div>
                    <dl className="recruiter-review-facts">
                        <div><dt>Stage</dt><dd>{candidateSetupStageOptions.find((stage) => stage.id === interviewStage)?.label}</dd></div>
                        <div><dt>Question source</dt><dd>{preparedQuestionSet.source === "generated" ? "Generated" : "Entered manually"}</dd></div>
                        <div><dt>Delivery</dt><dd>Not sent yet</dd></div>
                    </dl>
                    <div className="recruiter-review-recipients">
                        {recipients.map((recipient) => (
                            <div key={recipient.id}><strong>{recipient.firstName} {recipient.lastName}</strong><span>{recipient.email}</span></div>
                        ))}
                    </div>
                    <div className="recruiter-create-actions recruiter-create-actions--split">
                        <Button type="button" emphasis="secondary" density="comfortable" shape="app" label="strong" onClick={() => setPhase("recipients")} disabled={busyAction !== null}>
                            <ArrowLeft size={17} /> Back to candidates
                        </Button>
                        <Button type="button" emphasis="primary" density="comfortable" shape="app" label="strong" onClick={createInvitations} disabled={busyAction !== null}>
                            {busyAction === "create" ? <Loader2 className="recruiter-spin" size={17} /> : <Users size={17} />}
                            {busyAction === "create" ? "Creating invitations" : "Create invitations"}
                        </Button>
                    </div>
                </section>
            ) : null}

            {phase === "complete" ? (
                <section className="recruiter-create-section recruiter-invitation-results" aria-labelledby="invitation-results-title">
                    <div className="recruiter-invitation-results__success"><Check size={22} /></div>
                    <p className="type-eyebrow">Invitations ready</p>
                    <h1 id="invitation-results-title">Share the invitations</h1>
                    <p className="recruiter-invitation-results__guidance">
                        Send each personal link through Interview Coach or use the copy options in your usual candidate message.
                    </p>
                    <div className="recruiter-invitation-results__actions">
                        <Button
                            type="button"
                            emphasis="primary"
                            density="comfortable"
                            shape="app"
                            label="strong"
                            disabled={!createdBatchId || busyAction !== null || !hasDeliverableRecipient}
                            onClick={deliverInvitations}
                        >
                            {busyAction === "deliver" ? <Loader2 className="recruiter-spin" size={17} /> : <Mail size={17} />}
                            {busyAction === "deliver"
                                ? "Sending invitations"
                                : hasRetryableFailure
                                    ? "Retry failed delivery"
                                    : allProviderAccepted
                                        ? "Accepted by email provider"
                                        : deliveryValues.length > 0
                                            ? "Delivery needs review"
                                            : "Send invitations"}
                        </Button>
                        {createdBatchId ? (
                            <Link className="recruiter-handoff-manage-link" href={`/recruiter/invitations/${createdBatchId}`}>
                                Manage invitations <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                        ) : null}
                    </div>
                    <div className="recruiter-invitation-link-list">
                        {invitations.map((invitation) => (
                            <article key={invitation.recipientId}>
                                <div>
                                    <strong>{invitation.firstName} {invitation.lastName}</strong>
                                    <span>{invitation.email}</span>
                                    <span className={`recruiter-delivery-status is-${deliveryResults[invitation.recipientId]?.status ?? "ready"}`}>
                                        {deliveryStatusLabel(deliveryResults[invitation.recipientId])}
                                    </span>
                                </div>
                                <input aria-label={`Invite link for ${invitation.firstName} ${invitation.lastName}`} readOnly value={invitation.inviteLink} />
                                <div className="recruiter-invitation-link-list__actions">
                                    <Button type="button" emphasis="secondary" density="compact" shape="app" label="strong" onClick={() => copyInviteLink(invitation)}>
                                        {copiedItem?.recipientId === invitation.recipientId && copiedItem.kind === "link" ? <Check size={16} /> : <Clipboard size={16} />}
                                        {copiedItem?.recipientId === invitation.recipientId && copiedItem.kind === "link" ? "Copied" : "Copy link"}
                                    </Button>
                                    <Button type="button" emphasis="secondary" density="compact" shape="app" label="strong" onClick={() => copyInvitationMessage(invitation)}>
                                        {copiedItem?.recipientId === invitation.recipientId && copiedItem.kind === "message" ? <Check size={16} /> : <Copy size={16} />}
                                        {copiedItem?.recipientId === invitation.recipientId && copiedItem.kind === "message" ? "Copied" : "Copy message"}
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            <p className="sr-only" aria-live="polite">
                {busyAction === "generate" ? "Generating questions" : busyAction === "manual" ? "Saving questions" : busyAction === "create" ? "Creating invitations" : busyAction === "deliver" ? "Sending invitations" : ""}
            </p>
        </main>
    );
}

function emptyQuestions(stage: CandidateSetupStageId) {
    return Array.from({ length: getCandidateStageBaselineQuestionCount(stage) }, () => "");
}

function createRecipientDraft(): RecipientDraft {
    return {
        id: createBrowserActionKey(),
        firstName: "",
        lastName: "",
        email: "",
        requisitionReference: "",
        resumeText: "",
    };
}

function toRecipientInput(recipient: RecipientDraft) {
    return {
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        email: recipient.email,
        requisitionReference: recipient.requisitionReference,
        resumeText: recipient.resumeText,
    };
}

function createBrowserActionKey() {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
    return `recruiter-action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

function deliveryStatusLabel(result: DeliveryResult | undefined) {
    if (!result) return "Ready to share";
    if (result.status === "provider_accepted") return "Accepted by email provider";
    if (result.status === "in_progress") return "Delivery in progress";
    if (result.status === "outcome_unknown") return "Delivery outcome needs review";
    if (result.status === "failed" && result.retryable) return "Delivery failed - retry available";
    return "Delivery could not be retried";
}
