// Shared mock data + small helpers for the candidate UI kit.
window.CandidateData = {
  role: "Senior Product Designer",
  stage: "Full-loop interview",
  plan: [
    { label: "Screening", count: 2 },
    { label: "Behavioral", count: 3 },
    { label: "Culture / Fit", count: 1 },
    { label: "Case / Scenario", count: 1 },
    { label: "Technical / Role-Specific", count: 1 },
  ],
  questions: [
    { id: "q1", cat: "Behavioral", text: "Tell me about a time you resolved a conflict on your team." },
    { id: "q2", cat: "Case / Scenario", text: "Walk me through how you'd redesign an onboarding flow with a 40% drop-off." },
    { id: "q3", cat: "Screening", text: "Why are you interested in this role, and why now?" },
  ],
  skills: [
    { label: "Structure", state: "Clear", pct: 72 },
    { label: "Specificity", state: "Strong", pct: 88 },
    { label: "Outcomes", state: "Emerging", pct: 46 },
    { label: "Role fit", state: "Clear", pct: 64 },
  ],
  categories: [
    { label: "Screening", practiced: 2, total: 2, state: "Strong" },
    { label: "Behavioral", practiced: 2, total: 3, state: "Clear" },
    { label: "Culture / Fit", practiced: 0, total: 1, state: "Not practiced" },
    { label: "Case / Scenario", practiced: 1, total: 1, state: "Emerging" },
    { label: "Technical", practiced: 0, total: 1, state: "Not practiced" },
  ],
  recent: [
    { q: "A time you influenced without authority", cat: "Behavioral", when: "2h ago", assessment: "outstanding" },
    { q: "Prioritizing a roadmap with limited data", cat: "Case / Scenario", when: "Yesterday", assessment: "satisfactory" },
    { q: "Tell me about yourself", cat: "Screening", when: "Yesterday", assessment: "outstanding" },
  ],
  stateVariant: {
    "Strong": "readinessHigh",
    "Clear": "progressSolid",
    "Emerging": "readinessMedium",
    "Not practiced": "progressIdle",
  },
};
