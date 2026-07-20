import type { EVIDENCE_MARKERS } from "@/features/evaluation-v2/evidence-first-evaluator-contract";

export type CandidateEvidenceMarkerId = typeof EVIDENCE_MARKERS[number];

export const CANDIDATE_EVIDENCE_MARKER_LABELS: Record<CandidateEvidenceMarkerId, string> = {
    direct_answer: "Direct answer",
    context: "Context",
    example: "Example",
    specific_detail: "Specific detail",
    personal_action: "Your action",
    outcome: "Outcome",
    tradeoff: "Tradeoff or constraint",
    role_skill_signal: "Role-relevant skill",
    takeaway: "Takeaway",
    reasoning: "Reasoning",
    problem_framing: "Problem framing",
    priority: "Priority",
    recommendation: "Recommendation",
    next_step: "Next step",
    learning: "Learning",
    role_connection: "Role connection",
    stakeholder_awareness: "Stakeholder awareness",
    practical_application: "Practical application",
    motivation: "Motivation",
    self_awareness: "Self-awareness",
    logistics: "Logistics",
    professional_boundary: "Professional boundary",
};

export function getCandidateEvidenceMarkerLabel(markerId: CandidateEvidenceMarkerId) {
    return CANDIDATE_EVIDENCE_MARKER_LABELS[markerId];
}
