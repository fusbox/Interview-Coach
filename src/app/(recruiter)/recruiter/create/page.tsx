
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft } from "lucide-react";
import { Details, QuestionInput, STAR_TEMPLATE, PERMA_TEMPLATE, DEV_CANDIDATE_POOL, DEV_JOB_POOL, RecruiterProfile, InviteResult } from "./constants";

// Sub-components
import { StepJobAndQuestions } from "./components/StepJobAndQuestions";
import { StepCandidates, CandidateRow } from "./components/StepCandidates";
import { StepPreviewCombined } from "./components/StepPreviewCombined";

import { fetchTemplates, saveTemplateAction } from "../templates/actions";
import { RecruiterTemplate } from "@/lib/domain/template";

export default function CreateInviteWizard() {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Reset scroll on step change (Wizard flow)
    useEffect(() => {
        window.scrollTo(0, 0);
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

    const [error, setError] = useState<string | null>(null);

    const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile>({
        name: "",
        email: "",
        phone: "",
        title: "",
        company: "Rangam Consultants Inc."
    });

    // Fetch Recruiter Profile & Templates
    useEffect(() => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Fetch Profile
                const { data } = await supabase
                    .from('recruiter_profiles')
                    .select('*')
                    .eq('recruiter_id', user.id)
                    .single();

                const name = data ? `${data.first_name} ${data.last_name || ''}`.trim() : "Recruiter";

                setRecruiterProfile({
                    name: name || "Recruiter",
                    email: user.email || "",
                    phone: data?.phone || "",
                    title: data?.title || "Recruiter",
                    company: data?.company || "Rangam Consultants Inc."
                });

                // Fetch Templates
                const { templates: t } = await fetchTemplates();
                setTemplates(t);
            }
        };
        fetchData();
    }, []);

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

    // Stale State Protection: Clear results if job/candidates change
    useEffect(() => {
        if (inviteResults.length > 0) {
            setInviteResults([]);
        }
    }, [details.role, details.jd, candidates]); // Only clear if inputs change

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
                setError("Please add at least one question.");
                setIsLoading(false);
                return;
            }

            if (candidates.length === 0) {
                setError("Please add at least one candidate.");
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
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to create invites");

            if (data.results) {
                setInviteResults(data.results);
                // No longer advancing to step 4
            }
        } catch (e: unknown) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to create invites");
        } finally {
            setIsLoading(false);
        }
    };


    const StepFooter = ({ onBack, onNext, nextLabel, isNextDisabled, customAction }: { onBack?: () => void, onNext: () => void, nextLabel: string | React.ReactNode, isNextDisabled?: boolean, customAction?: React.ReactNode }) => (
        <div className="mt-8 pt-8 border-t border-border/30">
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-4 w-full">
                <div>
                    {onBack && (
                        <Button
                            variant="outline"
                            onClick={onBack}
                            className="w-full sm:w-auto h-12 sm:h-11 shadow-flat rounded-2xl"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                    )}
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                    {customAction}
                    <Button
                        onClick={onNext}
                        disabled={isNextDisabled}
                        className="w-full sm:w-auto h-12 sm:h-11 text-base sm:text-sm font-semibold shadow-raised-1 rounded-2xl"
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
        if (!details.role) return;
        setIsGeneratingQuestions(true);
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
        } catch (e) {
            console.error("AI question generation failed:", e);
        } finally {
            setIsGeneratingQuestions(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-8 pt-24 md:py-8 transition-all duration-300">
            {/* Stepper Header */}
            {step <= 3 && (
                <div className="fixed top-0 left-0 right-0 z-30 bg-surface-base/95 backdrop-blur-md px-4 py-3 border-b border-border/50 md:static md:bg-transparent md:border-none md:p-0 md:m-0 md:mb-10 transition-all duration-base ease-standard">
                    <div className="relative">
                        <div className="absolute left-0 right-0 top-[15px] h-[2px] bg-surface-subtle -z-10" />
                        <div className="flex w-full max-w-2xl mx-auto">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={`flex-1 flex flex-col items-center group cursor-pointer transition-all duration-base ${s < step ? 'text-state-success' : (s === step ? 'text-primary' : 'text-text-disabled')}`}
                                    onClick={() => s <= step ? setStep(s as 1 | 2 | 3) : null}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-2 transition-all duration-base
                                         ${s < step ? 'border-state-success bg-surface-subtle text-state-success' :
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
                    isGenerated={inviteResults.length > 0}
                    results={inviteResults}
                    error={error}
                    recruiterProfile={recruiterProfile}
                    onNewInvite={() => {
                        setInviteResults([]);
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
    );
}
