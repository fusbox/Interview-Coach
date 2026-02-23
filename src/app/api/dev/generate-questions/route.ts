"use server";

import { NextRequest, NextResponse } from "next/server";
import { Logger } from "@/lib/logger";
import { ai, AI_MODELS } from "@/lib/server/services/ai-config";
import { showDemoTools } from "@/lib/feature-flags";

export async function POST(req: NextRequest) {
    // Demo-mode gate (replaces hardcoded dev gate)
    if (!showDemoTools()) {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    try {
        const { role, jobDescription, resume } = await req.json();

        if (!role) {
            return NextResponse.json({ error: "Role is required" }, { status: 400 });
        }

        if (!ai) {
            Logger.warn("[Dev] No API key, returning mock questions");
            return NextResponse.json(getMockQuestions(role));
        }

        // --- Inclusive Logic Detection ---
        const roleLower = role.toLowerCase();
        const isEntryLevelOrBlueCollar =
            roleLower.includes('warehouse') ||
            roleLower.includes('associate') ||
            roleLower.includes('clerk') ||
            roleLower.includes('helper') ||
            roleLower.includes('worker') ||
            roleLower.includes('driver') ||
            roleLower.includes('aide') ||
            roleLower.includes('healthcare') ||
            roleLower.includes('service') ||
            roleLower.includes('food') ||
            roleLower.includes('hospitality') ||
            roleLower.includes('entry') ||
            roleLower.includes('junior') ||
            roleLower.includes('apprentice');

        const isSeniorOrCorporate =
            roleLower.includes('senior') ||
            roleLower.includes('lead') ||
            roleLower.includes('manager') ||
            roleLower.includes('director') ||
            roleLower.includes('vp') ||
            roleLower.includes('head') ||
            roleLower.includes('architect') ||
            roleLower.includes('principal');

        const prompt = `
SYSTEM:
You are a Lead Recruiter designing high-fidelity interview questions for a "${role}" position.
Your goal is to create a realistic, inclusive, and role-appropriate interview set.

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}\n` : ''}
${resume ? `CANDIDATE RESUME:\n${resume}\n` : ''}

PHASE 1: SIGNAL ANALYSIS (Internal Reasoning)
1. Extract 3-4 core "Unspoken" requirements from the JD (e.g., physical stamina for warehouse, empathy for healthcare, or strategic influence for leaders).
2. If a RESUME is provided, identify 2-3 specific background markers to anchor questions (e.g., previous experience in a similar industry).

PHASE 2: COGNITIVE CALIBRATION
${isEntryLevelOrBlueCollar ? `
- ROLE TYPE: Entry-Level / Blue-Collar / Service.
- READABILITY: STRICT 5th-Grade readability. Use plain phrasing, common terms, and short sentences.
- FOCUS: Reliability, Teamwork, Safety, and Patient/Customer Care.
- BEHAVIORAL STYLE: Use "Concrete Situational Scenarios" (e.g., "What would you do if...") instead of abstract "Tell me about a time..." questions.
` : isSeniorOrCorporate ? `
- ROLE TYPE: Senior / Corporate / Leadership.
- READABILITY: Professional, concise, and strategic.
- FOCUS: Rationale, Influence, Result-drive, and Strategic Trade-offs.
- BEHAVIORAL STYLE: Focus on complexity, choice, and long-term impact.
` : `
- ROLE TYPE: Standard Professional.
- READABILITY: Clear, professional 8th-grade level.
- FOCUS: Competency mastery and role fit.
`}

PHASE 3: QUESTION GENERATION
Generate interview questions in these categories:

1. Behavioral Questions - Generate exactly 4 distinct behavioral questions as a keyed object.
   - Each question must be a complete, cohesive scenario (e.g., "Tell me about a time when..."). 
   - DO NOT fragmented them into S/T/A/R segments.
   - KEYS: "Conflict/Resolution", "Adaptability", "Initiative/Growth", "Role-Specific Scenario".

2. Culture/Fit Questions - Generate exactly 5 questions as a keyed object based on PERMA dimensions:
   - KEYS: "Positive Emotion", "Engagement", "Relationships", "Meaning", "Accomplishment".
   - Anchor these to the specific company environment implied in the JD.

3. Technical/Hard Skill Questions - Generate 1-2 questions.
   - Anchor these to the actual tools or tasks mentioned in the JD.
   - If a Resume is provided, tie the technical question to their stated tools/experience.

OUTPUT FORMAT (strict JSON, no other text):
{
  "behavioral": {
    "Conflict/Resolution": "complete question text",
    "Adaptability": "complete question text",
    "Initiative/Growth": "complete question text",
    "Role-Specific Scenario": "complete question text"
  },
  "culture": {
    "Positive Emotion": "complete question text",
    "Engagement": "complete question text",
    "Relationships": "complete question text",
    "Meaning": "complete question text",
    "Accomplishment": "complete question text"
  },
  "technical": [
    { "text": "question text" }
  ]
}

RULES:
- Questions must be relevant to the specific role and candidates.
- Use plain, supportive language for entry-level roles.
- Do not mention the word "STAR" or "PERMA" in the question text.
- Output ONLY valid JSON.`;

        const response = await ai.models.generateContent({
            model: AI_MODELS.QUESTION_GEN,
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' },
        });

        const text = response.text;
        if (!text) throw new Error("Empty AI response");

        const result = JSON.parse(text);
        return NextResponse.json(result);

    } catch (error) {
        Logger.error("[Dev] Question generation failed", error);
        return NextResponse.json(
            { error: "Failed to generate questions" },
            { status: 500 }
        );
    }
}

function getMockQuestions(role: string) {
    return {
        behavioral: {
            "Conflict/Resolution": `Tell me about a time you had to resolve a conflict with a teammate or patient while working as a ${role}.`,
            "Adaptability": `Describe a situation where you had to adapt quickly to a major change in your shift or responsibilities.`,
            "Initiative/Growth": `Tell me about a time you took the initiative to improve a process or help a colleague without being asked.`,
            "Role-Specific Scenario": `Walk me through a specific role-specific challenge you faced as a ${role} and how you handled it.`
        },
        culture: {
            "Positive Emotion": `How do you maintain enthusiasm in your role as a ${role}?`,
            "Engagement": `What aspects of the ${role} position keep you most engaged?`,
            "Relationships": `How do you build effective working relationships with your team?`,
            "Meaning": `What does your work as a ${role} mean to you?`,
            "Accomplishment": `What professional accomplishment are you most proud of?`
        },
        technical: [
            { text: `What tools or techniques do you use most frequently as a ${role}?` }
        ]
    };
}
