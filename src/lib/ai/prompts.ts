import { Question, Blueprint } from "@/lib/domain/types";

/**
 * Shared reading level / seniority calibration context.
 * Import this in any AI service that generates candidate-facing text.
 */
export function getReadingLevelContext(role: string): string {
    const roleTitle = role.toLowerCase();

    // --- Categorization Logic (Synced with Question Generation) ---
    const isEntryLevelOrFrontline =
        roleTitle.includes('warehouse') ||
        roleTitle.includes('associate') ||
        roleTitle.includes('clerk') ||
        roleTitle.includes('helper') ||
        roleTitle.includes('worker') ||
        roleTitle.includes('driver') ||
        roleTitle.includes('aide') ||
        roleTitle.includes('healthcare') ||
        roleTitle.includes('service') ||
        roleTitle.includes('food') ||
        roleTitle.includes('hospitality') ||
        roleTitle.includes('entry') ||
        roleTitle.includes('junior') ||
        roleTitle.includes('apprentice') ||
        roleTitle.includes('coordinator') ||
        roleTitle.includes('assistant');

    const isSeniorOrLeadership =
        roleTitle.includes('senior') ||
        roleTitle.includes('lead') ||
        roleTitle.includes('manager') ||
        roleTitle.includes('director') ||
        roleTitle.includes('vp') ||
        roleTitle.includes('head') ||
        roleTitle.includes('architect') ||
        roleTitle.includes('principal');

    const isTechnical =
        roleTitle.includes('engineer') ||
        roleTitle.includes('developer') ||
        roleTitle.includes('data');

    // --- Context Assembly ---
    let context = `
READING LEVEL & TONE:
- Keep language professional, warm, and highly relatable.
- Avoid corporate jargon and abstract HR speak.
- Adopt a supportive coaching voice.
`;

    if (isEntryLevelOrFrontline) {
        context += `
- CRITICAL: This is an entry-level, frontline, or service-based role.
- READABILITY: STRICT 5th-Grade reading level.
- Use plain, simple, and direct language.
- Avoid abstract concepts; use concrete examples.
- Keep sentences short.
`;
    } else if (isSeniorOrLeadership || isTechnical) {
        context += `
- READABILITY: Professional, concise, and strategic.
- Adapt tone for a ${isSeniorOrLeadership ? 'senior leader' : 'technical professional'}: focused on impact, rationale, and complexity.
`;
    } else {
        context += `
- READABILITY: Clear, professional 8th-grade level.
- Focus on transparency and competency mastery.
`;
    }

    return context;
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

    // --- 2. Reading Level Context ---
    const readingLevelContext = getReadingLevelContext(blueprint?.title || '');

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
- If they lack direct experience, praise their ability to bridge non-obvious signals (transferrable skills) when they apply past frameworks to new problems.
- Do NOT hallucinate experiences they haven't claimed, but DO acknowledge when they successfully map past experience to the question's core competency.
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
${retryPrompt}
${resumeContext}

**Question**: "${question.text}"
**Category**: ${question.category}
${question.competencyId ? `**Target Competency**: ${question.competencyId}` : ''}
`;
}
