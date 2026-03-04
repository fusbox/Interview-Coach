import { Question, Blueprint } from "@/lib/domain/types";

/**
 * Shared reading level / seniority calibration context.
 * Import this in any AI service that generates candidate-facing text.
 */
export function getReadingLevelContext(role: string): string {
    return `
READING LEVEL & TONE:
- TARGET ROLE: "${role}"
- You MUST dynamically adapt your vocabulary, sentence structure, and tone to deeply resonate with a typical candidate applying for this specific role.
- IF FRONTLINE, ENTRY-LEVEL, LABOR, OR SERVICE (e.g., General Factory Laborer, Cashier, Warehouse Associate): STRICT 5th-grade reading level. Keep sentences short, direct, and highly concrete. AVOID all corporate jargon, abstract HR terminology, or overly theoretical concepts ("synergy", "paradigm", "leverage"). Talk like a plain-spoken mentor.
- IF SENIOR, LEADERSHIP, OR HIGHLY TECHNICAL (e.g., Director, Principal Engineer): Use professional, concise, and strategic language appropriate for a high-functioning peer. Focus on impact, rationale, and complexity.
- UNIVERSAL TONE: Regardless of the role, your voice must consistently be warm, supportive, and act as an encouraging, empathetic coach. Be direct but kind.
`;
}

/**
 * Shared coaching rigor / difficulty scalar.
 * Instructs the AI on how strict or lenient to be during evaluation.
 */
export function getCoachingRigorContext(role: string): string {
    const roleTitle = role.toLowerCase();

    const isEntryLevelOrFrontline =
        roleTitle.includes('warehouse') || roleTitle.includes('associate') || roleTitle.includes('clerk') ||
        roleTitle.includes('helper') || roleTitle.includes('worker') || roleTitle.includes('driver') ||
        roleTitle.includes('aide') || roleTitle.includes('healthcare') || roleTitle.includes('service') ||
        roleTitle.includes('food') || roleTitle.includes('hospitality') || roleTitle.includes('labor') ||
        roleTitle.includes('entry') || roleTitle.includes('junior') || roleTitle.includes('apprentice');

    const isSeniorOrLeadership =
        roleTitle.includes('senior') || roleTitle.includes('lead') || roleTitle.includes('manager') ||
        roleTitle.includes('director') || roleTitle.includes('vp') || roleTitle.includes('head') ||
        roleTitle.includes('architect') || roleTitle.includes('principal') || roleTitle.includes('executive');

    let context = `\nCOACHING RIGOR (DIFFICULTY SCALER):\n`;

    if (isEntryLevelOrFrontline) {
        context += `- STRICT INSTRUCTION: This is an entry-level or frontline role. Be HIGHLY LENIENT. Over-index on encouragement and affirmation. Only critique severe structural failures or total lack of relevance. Praise effort and basic clarity heavily.`;
    } else if (isSeniorOrLeadership) {
        context += `- STRICT INSTRUCTION: This is a senior/leadership role. Be HIGHLY RIGOROUS. Scrutinize strategic alignment, outcome quantification, brevity, and high-level decision rationale. Hold them to an executive standard while remaining professional and constructive.`;
    } else {
        context += `- STRICT INSTRUCTION: This is a mid-level professional role. Apply standard coaching rigor. Balance warm praise with direct, constructive critique on structure, storytelling, and specific impact metrics.`;
    }

    return context + `\n`;
}

export function buildAnalysisContext(
    question: Question,
    blueprint: Blueprint | undefined,
    intakeData: Record<string, unknown> | undefined,
    retryContext?: { trigger: 'user' | 'coach'; focus?: string }
): string {

    // --- 1. Blueprint Context ---
    let blueprintContext = '';

    if (blueprint) {
        blueprintContext = `
BLUEPRINT CONTEXT:
Job Role: ${blueprint.title || 'Unknown Role'}
Competencies: ${JSON.stringify(blueprint.competencies?.map((c: { id: string; title?: string; name?: string; description?: string; definition?: string }) => ({
            id: c.id,
            name: c.title || c.name,
            definition: c.description || c.definition
        })))}
`;
    }

    // --- 2. Reading Level & Rigor Context ---
    const readingLevelContext = getReadingLevelContext(blueprint?.title || '');
    const rigorContext = getCoachingRigorContext(blueprint?.title || '');

    // --- 3. Intake / Personalization Context ---
    let struggleContext = '';
    if (intakeData?.biggestStruggle) {
        const s = intakeData.biggestStruggle;
        struggleContext = `
    USER STRUGGLE AREA ("${s}"):
    - The user specifically wants help with: ${s}.
    - ${s === 'getting_started' ? 'Focus on: Hesitation and initial framing.' : ''}
    - ${s === 'staying_organized' ? 'Focus on: Structure and rambling.' : ''}
    - ${s === 'explaining_impact' ? 'Focus on: Outcomes and metrics.' : ''}
    - ${s === 'behavioral_storytelling' ? "Focus on: STAR Method adherence." : ''}
    - ${s === 'nerves_anxiety' ? 'Focus on: Tone and confidence. Be extra supportive.' : ''}
    `;
    }

    let goalContext = '';
    if (intakeData?.primaryGoal) {
        const g = intakeData.primaryGoal;
        goalContext = `
    USER GOAL ("${g}"):
    - ${g === 'build_confidence' ? 'Be extra encouraging.' : ''}
    - ${g === 'get_more_structured' ? 'Strictly evaluate structure.' : ''}
    - ${g === 'improve_metrics' ? 'Look for numbers and impact.' : ''}
    `;
    }

    let stageContext = '';
    if (intakeData?.stage) {
        const stage = intakeData.stage;
        stageContext = `
    INTERVIEW STAGE ("${stage}"):
    - ${stage === 'recruiter_screen' ? 'Focus on: Basic fit and clarity.' : ''}
    - ${stage === 'hiring_manager' ? 'Focus on: Competence and depth.' : ''}
    - ${stage === 'final_round' ? 'Focus on: Leadership and strategy.' : ''}
    `;
    }

    // --- 4. Retry / Targeted Practice Context ---
    let retryPrompt = '';
    if (retryContext) {
        if (retryContext.trigger === 'coach' && retryContext.focus) {
            retryPrompt = `
    TARGETED PRACTICE CONTEXT:
    - The user is retrying this question specifically to improve: "${retryContext.focus}".
    - Acknowledge if they improved on this dimension.
    - If they improved, be encouraging. If not, offer a different way to think about it.
`;
        } else {
            retryPrompt = `
    RETRY CONTEXT:
    - The user is voluntarily retrying this question to give a better answer.
    - Treat this as a fresh attempt but note any significant improvements if obvious.
`;
        }
    }

    // --- 4.5 Resume / Context Integration ---
    let resumeContext = '';
    if (intakeData?.resumeText) {
        resumeContext = `
CANDIDATE RESUME / EXPERIENCE:
${intakeData.resumeText}

TRANSFERRABLE SKILLS & CONTEXT RULES:
- Use this resume to understand their baseline trajectory and domain.
- Actively look for how their specific background (industry, scale, tooling) applies to the target role.
- CRITICAL INTERPRETATION: Candidates will often answer questions using experiences from completely different industries. This is NOT a tangent or disconnected. A tangent ONLY occurs if they fail to address the underlying psychological or behavioral competency (e.g., adaptability, attention to detail).
- You MUST actively reward and affirm candidates for applying past frameworks to new problems, even if the domain nouns (e.g., POS vs machine) do not match the target role.
- If they lack direct experience, praise their ability to bridge non-obvious signals.
`;
    }

    // --- 5. Assembly ---
    return `
You are an expert Interview Coach.
Your goal is to evaluate the candidate's answer and provide actionable, structured feedback.

${blueprintContext}
${struggleContext}
${goalContext}
${stageContext}
${readingLevelContext}
${rigorContext}
${retryPrompt}
${resumeContext}

**Question**: "${question.text}"
**Category**: ${question.category}
${question.competencyId ? `**Target Competency**: ${question.competencyId}` : ''}
`;
}
