
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, RotateCcw } from "lucide-react";
import { Details, InviteBatchSummary, QuestionInput, STAR_TEMPLATE, PERMA_TEMPLATE, DEV_CANDIDATE_POOL, DEV_JOB_POOL, RecruiterProfile, InviteFailure, InviteResult } from "./constants";

// Sub-components
import { StepJobAndQuestions } from "./components/StepJobAndQuestions";
import { StepCandidates, CandidateRow } from "./components/StepCandidates";
import { StepPreviewCombined } from "./components/StepPreviewCombined";

import { fetchTemplates, saveTemplateAction } from "../templates/actions";
import { RecruiterTemplate } from "@/lib/domain/template";
import { normalizeRecruiterSignature } from "@/lib/recruiter-signature";
import { DEFAULT_RECRUITER_COMPANY, DEFAULT_RECRUITER_NAME } from "@/lib/config/recruiter-defaults";
import { E2E_RECRUITER_EMAIL, isClientE2EMode } from "@/lib/e2e/test-mode";
import { canShowReplayTourButton } from "@/lib/feature-flags";
import { useTour } from "@/components/ui/tour";
import {
    RECRUITER_CREATE_INVITE_TOUR_ID,
    TOUR_RESET_SEARCH_PARAM,
} from "@/features/tours/recruiter-tour-provider";

function createIdempotencyKey() {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `invite-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default function CreateInviteWizard() {
    const router = useRouter();
    const { activeTourId, activeStepId } = useTour();
    const isCreateTourActive = activeTourId === RECRUITER_CREATE_INVITE_TOUR_ID;
    const isCreateTourLocked = isCreateTourActive;
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const stepRegionRef = useRef<HTMLDivElement>(null);

    // Reset scroll on step change (Wizard flow)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [step]);

    useEffect(() => {
        stepRegionRef.current?.focus();
        setStatusMessage(`Step ${step} loaded.`);
    }, [step]);

    const [details, setDetails] = useState<Details>({
        role: "", jd: "", firstName: "", lastName: "", candidateEmail: "", reqId: ""
    });

    const [candidates, setCandidates] = useState<CandidateRow[]>([
        { id: 'cand-initial', firstName: "", lastName: "", email: "" }
    ]);

    // Questions State
    const [star, setStar] = useState<QuestionInput[]>(STAR_TEMPLATE);
    const [perma, setPerma] = useState<QuestionInput[]>(PERMA_TEMPLATE);
    const [technical, setTechnical] = useState<QuestionInput[]>([{ id: 'tech-1', text: '', category: 'Technical', label: 'Technical Q1' }]);

    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

    const [templates, setTemplates] = useState<RecruiterTemplate[]>([]);

    // Batch Results
    const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);
    const [inviteFailures, setInviteFailures] = useState<InviteFailure[]>([]);
    const [inviteSummary, setInviteSummary] = useState<InviteBatchSummary | null>(null);
    const hasInviteResults = inviteResults.length > 0;
    const previousDraftSignatureRef = useRef<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [createInviteKey, setCreateInviteKey] = useState(() => createIdempotencyKey());
    const [tourPreviewOpen, setTourPreviewOpen] = useState(false);
    const tourAutofillRef = useRef<Set<string>>(new Set());

    const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile>({
        name: "",
        email: "",
        phone: "",
        title: "",
        company: DEFAULT_RECRUITER_COMPANY
    });
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

    // Fetch Recruiter Profile & Templates
    useEffect(() => {
        if (isClientE2EMode()) {
            setCurrentUserEmail(E2E_RECRUITER_EMAIL);
            setRecruiterProfile(normalizeRecruiterSignature({
                name: DEFAULT_RECRUITER_NAME,
                email: E2E_RECRUITER_EMAIL,
                company: DEFAULT_RECRUITER_COMPANY
            }));
            setTemplates([]);
            return;
        }

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserEmail(user.email ?? null);
                // Fetch Profile
                const { data } = await supabase
                    .from('recruiter_profiles')
                    .select('*')
                    .eq('recruiter_id', user.id)
                    .single();

                const name = data ? `${data.first_name} ${data.last_name || ''}`.trim() : DEFAULT_RECRUITER_NAME;

                setRecruiterProfile(normalizeRecruiterSignature({
                    name,
                    email: user.email || "",
                    phone: data?.phone,
                    title: data?.title,
                    company: data?.company
                }));

                // Fetch Templates
                const { templates: t } = await fetchTemplates();
                setTemplates(t);
            }
        };
        fetchData();
    }, []);

    const canReplayTour = canShowReplayTourButton(currentUserEmail);

    const searchParams = useSearchParams();
    const templateIdFromUrl = searchParams.get("templateId");

    // Handle URL Template Prefill
    useEffect(() => {
        if (templateIdFromUrl && templates.length > 0) {
            const template = templates.find(t => t.id === templateIdFromUrl);
            if (template) {
                setDetails(prev => ({ ...prev, role: template.targetRole }));
                setStar(template.questions.star);
                setPerma(template.questions.perma);
                setTechnical(template.questions.technical);
            }
        }
    }, [templateIdFromUrl, templates]);

    const draftSignature = useMemo(() => JSON.stringify({
        role: details.role,
        jd: details.jd,
        reqId: details.reqId,
        candidates: candidates.map((candidate) => ({
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            email: candidate.email,
            resumeText: candidate.resumeText || ""
        })),
        star: star.map(({ id, text, category, label }) => ({ id, text, category, label })),
        perma: perma.map(({ id, text, category, label }) => ({ id, text, category, label })),
        technical: technical.map(({ id, text, category, label }) => ({ id, text, category, label }))
    }), [details.role, details.jd, details.reqId, candidates, star, perma, technical]);

    // Stale State Protection: Clear results only when the underlying draft changes after generation.
    useEffect(() => {
        const previousSignature = previousDraftSignatureRef.current;
        previousDraftSignatureRef.current = draftSignature;

        if (previousSignature && previousSignature !== draftSignature && inviteResults.length > 0) {
            setInviteResults([]);
            setInviteFailures([]);
            setInviteSummary(null);
        }
    }, [draftSignature, inviteResults.length]);

    useEffect(() => {
        setCreateInviteKey(createIdempotencyKey());
    }, [details.role, details.jd, details.reqId, candidates, star, perma, technical]);

    const handleSaveTemplate = async (name: string, isShared: boolean) => {
        const res = await saveTemplateAction({
            name,
            isShared,
            targetRole: details.role,
            questions: {
                star: star.filter(q => q.text.trim()),
                perma: perma.filter(q => q.text.trim()),
                technical: technical.filter(q => q.text.trim())
            }
        });

        if (res.success && res.template) {
            setTemplates(prev => [res.template!, ...prev]);
        } else {
            throw new Error(res.error || "Failed to save template");
        }
    };

    const handleCreate = async () => {
        setIsLoading(true);
        setError(null);
        setErrorMessage(null);
        setInviteFailures([]);
        setInviteSummary(null);
        setStatusMessage("Generating invitations.");
        try {
            const allQuestions = [
                ...star,
                ...perma,
                ...technical
            ].filter(q => q.text.trim().length > 0)
                .map((q, idx) => ({
                    text: q.text,
                    category: q.category,
                    index: idx
                }));

            if (allQuestions.length === 0) {
                const message = "Please add at least one question.";
                setError(message);
                setErrorMessage(message);
                setIsLoading(false);
                return;
            }

            if (!details.role.trim()) {
                const message = "Please add the target role before creating invites.";
                setError(message);
                setErrorMessage(message);
                setIsLoading(false);
                return;
            }

            if (!details.reqId.trim()) {
                const message = "Please add the Req ID before creating invites.";
                setError(message);
                setErrorMessage(message);
                setIsLoading(false);
                return;
            }

            if (!details.jd.trim()) {
                const message = "Please add the job description before creating invites.";
                setError(message);
                setErrorMessage(message);
                setIsLoading(false);
                return;
            }

            if (candidates.length === 0) {
                const message = "Please add at least one candidate.";
                setError(message);
                setErrorMessage(message);
                setIsLoading(false);
                return;
            }

            const payload = {
                role: details.role,
                jobDescription: details.jd,
                candidates: candidates.map(c => ({
                    firstName: c.firstName,
                    lastName: c.lastName,
                    email: c.email,
                    reqId: details.reqId,
                    resumeText: c.resumeText || undefined
                })),
                questions: allQuestions
            };

            const res = await fetch("/api/recruiter/invites", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": createInviteKey
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message || data.error || "Failed to create invites");

            if (data.results) {
                setInviteResults(data.results);
                setStatusMessage("Invitation preview is ready.");
                // No longer advancing to step 4
            }

            const failures: InviteFailure[] = Array.isArray(data.failures) ? data.failures : [];
            const summary: InviteBatchSummary | null = data.summary ? data.summary : null;
            setInviteFailures(failures);
            setInviteSummary(summary);
            if (failures.length > 0) {
                const failedEmails = failures.map((failure) => failure.email).join(", ");
                const message = failures.length === candidates.length
                    ? `No invites were created. Failed candidates: ${failedEmails}.`
                    : `Some invites could not be created. Failed candidates: ${failedEmails}.`;
                setError(message);
                setErrorMessage(message);
            }
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : "Failed to create invites";
            setError(message);
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };


    const StepFooter = ({ onBack, onNext, nextLabel, isNextDisabled, disableManualNavigation, customAction }: { onBack?: () => void, onNext: () => void, nextLabel: string | React.ReactNode, isNextDisabled?: boolean, disableManualNavigation?: boolean, customAction?: React.ReactNode }) => (
        <div className="mt-8 pt-8 border-t border-border/30">
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-4 w-full">
                <div>
                    {onBack && (
                        <Button
                            emphasis="secondary"
                            density="comfortable"
                            shape="app"
                            label="strong"
                            onClick={onBack}
                            disabled={disableManualNavigation}
                            className="w-full sm:w-auto"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                    )}
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                    {customAction}
                    <Button
                        onClick={onNext}
                        disabled={isNextDisabled || disableManualNavigation}
                        emphasis="primary"
                        density="comfortable"
                        shape="app"
                        label="strong"
                        className="w-full sm:w-auto"
                    >
                        {nextLabel}
                    </Button>
                </div>
            </div>
        </div>
    );

    // ─── Dev Quick-Fill Helpers ─────────────────────────────────
    const randomizeCandidate = () => {
        const pick = DEV_CANDIDATE_POOL[Math.floor(Math.random() * DEV_CANDIDATE_POOL.length)];
        setCandidates(prev => [...prev, {
            id: `cand-${Date.now()}`,
            firstName: pick.firstName,
            lastName: pick.lastName,
            email: pick.email
        }]);
    };

    const randomizeJob = () => {
        const pick = DEV_JOB_POOL[Math.floor(Math.random() * DEV_JOB_POOL.length)];
        setDetails(prev => ({
            ...prev,
            reqId: pick.reqId,
            role: pick.role,
            jd: pick.jd
        }));
    };

    const generateQuestionsAI = async () => {
        if (!details.role.trim() || !details.jd.trim()) {
            const message = "Add a Target Role and Job Description first so AI can generate relevant interview questions.";
            setErrorMessage(message);
            throw new Error(message);
        }

        setIsGeneratingQuestions(true);
        setErrorMessage(null);
        setStatusMessage("Generating interview questions.");
        try {
            const res = await fetch("/api/questions/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: details.role, jobDescription: details.jd })
            });
            if (!res.ok) throw new Error("Generation failed");
            const data = await res.json();

            if (data.behavioral) {
                setStar(STAR_TEMPLATE.map(t => ({
                    ...t,
                    text: data.behavioral[t.label] || ""
                })));
            }
            if (data.culture) {
                setPerma(PERMA_TEMPLATE.map(t => ({
                    ...t,
                    text: data.culture[t.label] || ""
                })));
            }
            if (data.technical) {
                setTechnical(data.technical.slice(0, 2).map((q: { text: string }, i: number) => ({
                    id: `tech-${i + 1}`, text: q.text, category: 'Technical', label: `Technical Q${i + 1}`
                })));
            }
            setStatusMessage("AI-generated questions are ready.");
        } catch (e) {
            console.error("AI question generation failed:", e);
            const message = "AI question generation failed. Please review the job details and try again.";
            setErrorMessage(message);
            throw new Error(message);
        } finally {
            setIsGeneratingQuestions(false);
        }
    };

    const handleReplayTour = () => {
        const replayParams = new URLSearchParams({
            tour: RECRUITER_CREATE_INVITE_TOUR_ID,
            [TOUR_RESET_SEARCH_PARAM]: "1",
        });

        router.push(`/recruiter/settings?${replayParams.toString()}`);
    };

    useEffect(() => {
        if (activeTourId !== RECRUITER_CREATE_INVITE_TOUR_ID || !activeStepId) {
            setTourPreviewOpen(false);
            return;
        }

        if (
            activeStepId === "tour-recruiter-create-wizard" ||
            activeStepId === "tour-recruiter-create-job-details" ||
            activeStepId === "tour-recruiter-create-questions" ||
            activeStepId === "tour-recruiter-create-ai-generate"
        ) {
            setStep(1);
        }

        if (
            activeStepId === "tour-recruiter-create-candidates" ||
            activeStepId === "tour-recruiter-create-resume"
        ) {
            setStep(2);
        }

        if (
            activeStepId === "tour-recruiter-create-preview" ||
            activeStepId === "tour-recruiter-create-preview-modal"
        ) {
            setStep(3);
        }

        if (
            activeStepId === "tour-recruiter-create-job-details" &&
            !tourAutofillRef.current.has(activeStepId)
        ) {
            setDetails((previous) => ({
                ...previous,
                reqId: previous.reqId || "RANG-CS-101",
                role: previous.role || "Customer Service Representative",
                jd:
                    previous.jd ||
                    "Support candidates and customers with empathy, clear communication, accurate documentation, and timely follow-through across phone, chat, and email channels.",
            }));
            tourAutofillRef.current.add(activeStepId);
        }

        if (
            activeStepId === "tour-recruiter-create-questions" &&
            !tourAutofillRef.current.has(activeStepId)
        ) {
            setStar((previous) =>
                previous.map((question, index) => ({
                    ...question,
                    text:
                        question.text ||
                        [
                            "Tell me about a time you de-escalated a frustrated customer and what changed by the end of the conversation.",
                            "Describe a situation where you had to balance empathy with company policy during a support interaction.",
                        ][index] ||
                        question.text,
                }))
            );
            setPerma((previous) =>
                previous.map((question, index) => ({
                    ...question,
                    text:
                        question.text ||
                        [
                            "How do you stay positive and helpful during repetitive or high-volume support work?",
                            "What does a strong team handoff look like when you cannot solve a customer issue on your own?",
                            "How do you build trust quickly with someone who feels unheard?",
                            "What kind of manager feedback helps you improve fastest in a service role?",
                            "How do you keep yourself organized when priorities change throughout the day?",
                        ][index] ||
                        question.text,
                }))
            );
            setTechnical([
                {
                    id: "tech-tour-1",
                    text: "How would you document a customer issue so the next teammate can pick it up without losing context?",
                    category: "Technical",
                    label: "Technical Q1",
                },
                {
                    id: "tech-tour-2",
                    text: "What steps would you take before escalating a ticket that has already been reassigned twice?",
                    category: "Technical",
                    label: "Technical Q2",
                },
            ]);
            tourAutofillRef.current.add(activeStepId);
        }

        if (
            activeStepId === "tour-recruiter-create-candidates" &&
            !tourAutofillRef.current.has(activeStepId)
        ) {
            setCandidates([
                {
                    id: "tour-candidate-1",
                    firstName: "Fu",
                    lastName: "Chen",
                    email: "fusbox@gmail.com",
                    resumeText: "",
                },
            ]);
            tourAutofillRef.current.add(activeStepId);
        }

        if (
            activeStepId === "tour-recruiter-create-resume" &&
            !tourAutofillRef.current.has(activeStepId)
        ) {
            tourAutofillRef.current.add(activeStepId);
            void fetch("/AdminCS_resume.txt")
                .then((response) => response.text())
                .then((resumeText) => {
                    setCandidates((previous) =>
                        previous.map((candidate, index) =>
                            index === 0 ? { ...candidate, resumeText } : candidate
                        )
                    );
                })
                .catch(() => {
                    setCandidates((previous) =>
                        previous.map((candidate, index) =>
                            index === 0
                                ? {
                                      ...candidate,
                                      resumeText:
                                          candidate.resumeText ||
                                          "Customer service professional with experience supporting high-volume inbound requests, documenting issues clearly, and collaborating across teams to resolve escalations.",
                                  }
                                : candidate
                        )
                    );
                });
        }

        setTourPreviewOpen(activeStepId === "tour-recruiter-create-preview-modal");
    }, [activeStepId, activeTourId]);

    return (
        <div className="max-w-4xl mx-auto pb-8 pt-24 md:py-8 transition-all duration-300">
            {canReplayTour && (
                <div className="mb-4 flex justify-end md:mb-6">
                    <Button
                        type="button"
                        onClick={handleReplayTour}
                        emphasis="secondary"
                        density="compact"
                        shape="pill"
                        label="chrome"
                        className="gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Replay Tour 1
                    </Button>
                </div>
            )}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {statusMessage}
            </div>
            <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
                {errorMessage || ""}
            </div>
            {/* Stepper Header */}
            {step <= 3 && (
                <div
                    className="fixed top-0 left-0 right-0 z-30 bg-surface-base/95 backdrop-blur-md px-4 py-3 border-b border-border/50 md:static md:bg-transparent md:border-none md:p-0 md:m-0 md:mb-10 transition-all duration-base ease-standard"
                    data-tour-step-id="tour-recruiter-create-wizard"
                >
                    <div className="relative">
                        <div className="absolute left-0 right-0 top-[15px] h-[2px] bg-surface-subtle -z-10" />
                        <div className="flex w-full max-w-2xl mx-auto">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={`flex-1 flex flex-col items-center group cursor-pointer transition-all duration-base ${s < step ? 'text-emerald-800 dark:text-emerald-200' : (s === step ? 'text-primary' : 'text-text-disabled')}`}
                                    onClick={() => (!isCreateTourLocked && s <= step) ? setStep(s as 1 | 2 | 3) : null}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-2 transition-all duration-base
                                         ${s < step ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-200' :
                                            s === step ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]' :
                                                'border-border bg-surface-base group-hover:border-primary/50'}`}>
                                        {s < step ? <Check className="w-4 h-4" /> : s}
                                    </div>
                                    <span className="text-micro sm:text-xs font-bold uppercase tracking-widest text-center px-1 max-w-full line-clamp-2 break-words">
                                        {s === 1 ? 'Job & Questions' : s === 2 ? 'Candidates' : 'Invite'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div ref={stepRegionRef} tabIndex={-1} className="outline-none focus:outline-none focus-visible:outline-none">
            {step === 1 && (
                <StepJobAndQuestions
                    details={details} setDetails={setDetails}
                    star={star} setStar={setStar}
                    perma={perma} setPerma={setPerma}
                    technical={technical} setTechnical={setTechnical}
                    onNext={() => setStep(2)}
                    onRandomizeJob={randomizeJob}
                    onGenerateQuestionsAI={generateQuestionsAI}
                    isGeneratingQuestions={isGeneratingQuestions}
                    StepFooter={StepFooter}
                    templates={templates}
                    onSaveTemplate={handleSaveTemplate}
                    isTourLocked={isCreateTourLocked}
                />
            )}

            {step === 2 && (
                <StepCandidates
                    candidates={candidates}
                    setCandidates={setCandidates}
                    onBack={() => setStep(1)}
                    onNext={() => setStep(3)}
                    onRandomizeCandidate={randomizeCandidate}
                    StepFooter={StepFooter}
                    isTourLocked={isCreateTourLocked}
                />
            )}

            {step === 3 && (
                <StepPreviewCombined
                    details={details}
                    setDetailStep={() => setStep(1)}
                    star={star} perma={perma} technical={technical}
                    candidates={candidates}
                    setCandidateStep={() => setStep(2)}
                    onBack={() => setStep(2)}
                    onHandleCreate={handleCreate}
                    isLoading={isLoading}
                    isGenerated={hasInviteResults}
                    results={inviteResults}
                    failures={inviteFailures}
                    summary={inviteSummary}
                    error={error}
                    recruiterProfile={recruiterProfile}
                    forcedPreviewOpen={tourPreviewOpen}
                    disableSend={isCreateTourActive}
                    isTourLocked={isCreateTourLocked}
                    onNewInvite={() => {
                        setCreateInviteKey(createIdempotencyKey());
                        setInviteResults([]);
                        setInviteFailures([]);
                        setInviteSummary(null);
                        setStep(1);
                        setDetails({ role: "", jd: "", firstName: "", lastName: "", candidateEmail: "", reqId: "" });
                        setCandidates([]);
                        setStar(STAR_TEMPLATE);
                        setPerma(PERMA_TEMPLATE);
                        setTechnical([{ id: 'tech-1', text: '', category: 'Technical', label: 'Technical Q1' }]);
                    }}
                    onDashboard={() => window.location.href = '/recruiter'}
                />
            )}
            </div>
        </div>
    );
}
