"use client";

import { ArrowRight, Briefcase, Camera, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";

type InterviewStageId = "practice_only" | "screening" | "first_interview" | "follow_up" | "final_interview";
type ResumeSource = "paste" | "file" | "photo";

type StageOption = {
    id: InterviewStageId;
    label: string;
    detail: string;
    recommendedCount: number;
    recommendation: string;
};

const stageOptions: StageOption[] = [
    {
        id: "practice_only",
        label: "Not sure yet",
        detail: "Use this when you want broad practice before a specific interview is scheduled.",
        recommendedCount: 5,
        recommendation:
            "I recommend 5 questions so you can get useful coaching without making the first round feel heavy.",
    },
    {
        id: "screening",
        label: "Screening call",
        detail: "Prepare for early interest, background, availability, and fit questions.",
        recommendedCount: 5,
        recommendation:
            "I recommend 5 questions for a screening call because this stage is usually focused and quick.",
    },
    {
        id: "first_interview",
        label: "First interview",
        detail: "Practice a balanced set across role fit, examples, and work situations.",
        recommendedCount: 7,
        recommendation:
            "I recommend 7 questions so we can cover the main question types without turning this into a long session.",
    },
    {
        id: "follow_up",
        label: "Follow-up interview",
        detail: "Work on deeper examples, clarifying answers, and role-specific follow-up areas.",
        recommendedCount: 7,
        recommendation:
            "I recommend 7 questions so you can build on what may come next and still keep the practice manageable.",
    },
    {
        id: "final_interview",
        label: "Final interview",
        detail: "Prepare for decision-stage questions, judgment, examples, and closing confidence.",
        recommendedCount: 10,
        recommendation:
            "I recommend 10 questions because final rounds tend to ask for broader evidence and sharper examples.",
    },
];

const questionCountOptions = [3, 5, 7, 10];

export function CandidateSetupExperience() {
    const [selectedStage, setSelectedStage] = useState<InterviewStageId>("first_interview");
    const [questionCount, setQuestionCount] = useState(7);
    const [resumeSource, setResumeSource] = useState<ResumeSource>("paste");
    const [resumeAssetName, setResumeAssetName] = useState("");
    const [isPreparing, setIsPreparing] = useState(false);

    const activeStage = useMemo(
        () => stageOptions.find((stage) => stage.id === selectedStage) ?? stageOptions[2],
        [selectedStage],
    );

    function chooseStage(stage: StageOption) {
        setSelectedStage(stage.id);
        setQuestionCount(stage.recommendedCount);
    }

    function handleResumeAsset(event: ChangeEvent<HTMLInputElement>, source: ResumeSource) {
        const file = event.target.files?.[0];
        setResumeSource(source);
        setResumeAssetName(file?.name ?? "");
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsPreparing(true);
    }

    return (
        <main className="candidate-design-system setup-page">
            <section className="setup-hero app-grid">
                <div className="setup-hero__copy">
                    <p className="type-eyebrow setup-eyebrow">Candidate setup</p>
                    <h1>Tell me what interview you are preparing for.</h1>
                    <p>
                        Start with the role and job description. Add resume context if it helps, then choose the
                        interview stage and how much you want to practice first.
                    </p>
                </div>

                <aside className="setup-progress-card" aria-label="Setup progress">
                    <div className="setup-progress-card__icon" aria-hidden="true">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <p className="type-eyebrow">Next transition</p>
                        <h2>Practice plan first, session next.</h2>
                        <p>
                            After setup, I will prepare your first round and guide what to practice after you finish it.
                        </p>
                    </div>
                </aside>
            </section>

            <form className="setup-form app-grid" onSubmit={handleSubmit}>
                <div className="setup-form__main">
                    <section className="setup-panel" aria-labelledby="role-context-title">
                        <div className="setup-section-header">
                            <div className="setup-section-header__icon" aria-hidden="true">
                                <Briefcase size={18} />
                            </div>
                            <div>
                                <p className="type-eyebrow">Role context</p>
                                <h2 id="role-context-title">Start with the job in front of you.</h2>
                            </div>
                        </div>

                        <div className="setup-field-grid">
                            <label className="setup-field setup-field--full">
                                <span>Target role *</span>
                                <input name="targetRole" required placeholder="Example: Customer service representative" />
                            </label>

                            <label className="setup-field setup-field--full">
                                <span>Job description *</span>
                                <textarea
                                    name="jobDescription"
                                    required
                                    rows={7}
                                    placeholder="Paste the job description or the parts that explain the role, duties, and requirements."
                                />
                            </label>
                        </div>
                    </section>

                    <section className="setup-panel" aria-labelledby="resume-context-title">
                        <div className="setup-section-header">
                            <div className="setup-section-header__icon" aria-hidden="true">
                                <FileText size={18} />
                            </div>
                            <div>
                                <p className="type-eyebrow">Resume context</p>
                                <h2 id="resume-context-title">Add resume context if it helps.</h2>
                                <p>Resume context is optional. The coaching payload is text, whether pasted or extracted.</p>
                            </div>
                        </div>

                        <div className="resume-source-grid" role="group" aria-label="Resume input method">
                            <button
                                type="button"
                                className={resumeSource === "paste" ? "resume-source is-selected" : "resume-source"}
                                aria-pressed={resumeSource === "paste"}
                                onClick={() => setResumeSource("paste")}
                            >
                                <FileText size={18} aria-hidden="true" />
                                <span>Paste text</span>
                            </button>

                            <label className={resumeSource === "file" ? "resume-source is-selected" : "resume-source"}>
                                <Upload size={18} aria-hidden="true" />
                                <span>Upload file</span>
                                <input
                                    type="file"
                                    name="resumeFile"
                                    accept=".pdf,.doc,.docx,.txt,image/*"
                                    onChange={(event) => handleResumeAsset(event, "file")}
                                />
                            </label>

                            <label className={resumeSource === "photo" ? "resume-source is-selected" : "resume-source"}>
                                <Camera size={18} aria-hidden="true" />
                                <span>Take photo</span>
                                <input
                                    type="file"
                                    name="resumePhoto"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(event) => handleResumeAsset(event, "photo")}
                                />
                            </label>
                        </div>

                        {resumeAssetName ? (
                            <p className="resume-asset-note" aria-live="polite">
                                Selected: {resumeAssetName}. After extraction, review the text before starting.
                            </p>
                        ) : null}

                        <label className="setup-field setup-field--full">
                            <span>Resume text or extracted text</span>
                            <textarea
                                name="resumeText"
                                rows={6}
                                placeholder="Paste resume text here, or review extracted text here after file/photo processing is wired."
                            />
                        </label>
                    </section>

                    <section className="setup-panel" aria-labelledby="practice-details-title">
                        <div className="setup-section-header">
                            <div className="setup-section-header__icon" aria-hidden="true">
                                <CheckCircle2 size={18} />
                            </div>
                            <div>
                                <p className="type-eyebrow">Interview details</p>
                                <h2 id="practice-details-title">Choose the first round shape.</h2>
                            </div>
                        </div>

                        <fieldset className="setup-fieldset">
                            <legend>Interview stage *</legend>
                            <div className="stage-grid">
                                {stageOptions.map((stage) => (
                                    <button
                                        key={stage.id}
                                        type="button"
                                        className={selectedStage === stage.id ? "stage-card is-selected" : "stage-card"}
                                        aria-pressed={selectedStage === stage.id}
                                        onClick={() => chooseStage(stage)}
                                    >
                                        <strong>{stage.label}</strong>
                                        <span>{stage.detail}</span>
                                    </button>
                                ))}
                            </div>
                            <input type="hidden" name="interviewStage" value={selectedStage} required />
                        </fieldset>

                        <fieldset className="setup-fieldset">
                            <legend>Question count *</legend>
                            <div className="question-count-row">
                                {questionCountOptions.map((count) => (
                                    <button
                                        key={count}
                                        type="button"
                                        className={questionCount === count ? "count-option is-selected" : "count-option"}
                                        aria-pressed={questionCount === count}
                                        onClick={() => setQuestionCount(count)}
                                    >
                                        {count}
                                    </button>
                                ))}
                            </div>
                            <input type="hidden" name="questionCount" value={questionCount} required />
                            <p className="question-help">
                                {activeStage.recommendation} You can choose a different count, and after your first
                                session I will guide what to practice next.
                            </p>
                        </fieldset>
                    </section>
                </div>

                <aside className="setup-rail" aria-label="Setup summary">
                    <div className="setup-rail__card">
                        <p className="type-eyebrow">Your first round</p>
                        <dl>
                            <div>
                                <dt>Stage</dt>
                                <dd>{activeStage.label}</dd>
                            </div>
                            <div>
                                <dt>Recommended</dt>
                                <dd>{activeStage.recommendedCount} questions</dd>
                            </div>
                            <div>
                                <dt>Selected</dt>
                                <dd>{questionCount} questions</dd>
                            </div>
                        </dl>
                    </div>

                    <div className={isPreparing ? "setup-loading-card is-active" : "setup-loading-card"} aria-live="polite">
                        {isPreparing ? (
                            <>
                                <Loader2 className="setup-spinner" size={18} aria-hidden="true" />
                                <div>
                                    <strong>Building your practice plan.</strong>
                                    <span>Preparing the transition into your first session.</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={18} aria-hidden="true" />
                                <div>
                                    <strong>Ready when you are.</strong>
                                    <span>Required fields are marked with an asterisk.</span>
                                </div>
                            </>
                        )}
                    </div>

                    <button className="setup-submit" type="submit" disabled={isPreparing}>
                        {isPreparing ? "Preparing" : "Start practice"}
                        {isPreparing ? <Loader2 className="setup-spinner" size={16} aria-hidden="true" /> : <ArrowRight size={16} />}
                    </button>
                </aside>
            </form>
        </main>
    );
}
