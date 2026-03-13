export interface Details {
    role: string;
    jd: string;
    firstName: string;
    lastName: string;
    candidateEmail: string;
    reqId: string;
}

export interface QuestionInput {
    id: string; // temp id for UI key
    text: string;
    category: string;
    label: string; // Display label (e.g. "Situation")
    isLocked?: boolean; // If structural (STAR/PERMA)
}

export const STAR_TEMPLATE: QuestionInput[] = [
    { id: 'b1', text: '', category: 'STAR', label: 'Conflict/Resolution', isLocked: false },
    { id: 'b2', text: '', category: 'STAR', label: 'Adaptability', isLocked: false },
    { id: 'b3', text: '', category: 'STAR', label: 'Initiative/Growth', isLocked: false },
    { id: 'b4', text: '', category: 'STAR', label: 'Role-Specific Scenario', isLocked: false },
];

export const PERMA_TEMPLATE: QuestionInput[] = [
    { id: 'p', text: '', category: 'PERMA', label: 'Positive Emotion', isLocked: true },
    { id: 'e', text: '', category: 'PERMA', label: 'Engagement', isLocked: true },
    { id: 'rel', text: '', category: 'PERMA', label: 'Relationships', isLocked: true },
    { id: 'm', text: '', category: 'PERMA', label: 'Meaning', isLocked: true },
    { id: 'acc', text: '', category: 'PERMA', label: 'Accomplishment', isLocked: true },
];

export interface StepFooterProps {
    onBack?: () => void;
    onNext: () => void;
    nextLabel: string | React.ReactNode;
    isNextDisabled?: boolean;
    customAction?: React.ReactNode;
}

export interface RecruiterProfile {
    name: string;
    email: string;
    phone: string;
    title?: string;
    company?: string;
}

export interface InviteResult {
    firstName: string;
    lastName: string;
    email: string;
    link: string;
}

// ─── Dev-Only Data Pools ────────────────────────────────────────
export const DEV_CANDIDATE_POOL = [
    { firstName: "Ian", lastName: "Caldwell", email: "icclearly@example.com" },
    { firstName: "Maria", lastName: "Santos", email: "msantos@example.com" },
    { firstName: "Jamal", lastName: "Williams", email: "jwilliams@example.com" },
    { firstName: "Priya", lastName: "Patel", email: "ppatel@example.com" },
    { firstName: "Chen", lastName: "Wei", email: "cwei@example.com" },
    { firstName: "Aisha", lastName: "Mohammed", email: "amohammed@example.com" },
    { firstName: "Tyler", lastName: "Robinson", email: "trobinson@example.com" },
    { firstName: "Sofia", lastName: "Hernandez", email: "shernandez@example.com" },
];

export const DEV_JOB_POOL = [
    {
        reqId: "RCI-QD-18250-1",
        role: "Phlebotomist II",
        jd: "Responsible for performing venipuncture and capillary blood draws on patients of all ages. Must maintain accuracy in specimen labeling, follow infection control protocols, and demonstrate strong patient communication skills. 1+ years clinical phlebotomy experience required."
    },
    {
        reqId: "RCI-IT-29410-3",
        role: "Help Desk Technician I",
        jd: "Provide first-line technical support via phone, email, and ticketing system. Troubleshoot hardware, software, and network issues. Document solutions in knowledge base. CompTIA A+ preferred. Strong customer service orientation required."
    },
    {
        reqId: "RCI-FN-33105-2",
        role: "Accounts Payable Specialist",
        jd: "Process vendor invoices, reconcile statements, and manage payment schedules. Experience with ERP systems (SAP or Oracle preferred). Strong attention to detail, 2+ years AP experience. Associate's degree in Accounting or related field."
    },
    {
        reqId: "RCI-HR-41220-1",
        role: "Recruitment Coordinator",
        jd: "Support full-cycle recruiting by scheduling interviews, managing ATS data, coordinating onboarding logistics, and maintaining candidate communications. Strong organizational skills, proficiency in Workday or similar ATS. Bachelor's degree preferred."
    },
    {
        reqId: "RCI-MK-55780-4",
        role: "Social Media Marketing Associate",
        jd: "Create and schedule content across Instagram, LinkedIn, and TikTok. Monitor engagement metrics, assist with campaign planning, and collaborate with design team. 1-2 years social media experience, familiarity with Hootsuite or Sprout Social."
    },
    {
        reqId: "RCI-WH-12001-1",
        role: "Warehouse Associate",
        jd: "Responsible for receiving, labeling, and storing incoming shipments. Must be able to lift up to 50 lbs, operate a pallet jack, and maintain a clean workspace. Strong focus on safety and reliability. High school diploma or equivalent preferred."
    },
    {
        reqId: "RCI-HC-22045-2",
        role: "Personal Care Aide",
        jd: "Assist elderly or disabled clients with daily activities, including personal hygiene, light housekeeping, and meal preparation. Must have reliable transportation, a compassionate attitude, and clear communication skills. Certification a plus but not required."
    },
    {
        reqId: "RCI-AD-31090-3",
        role: "Data Entry Clerk",
        jd: "Accurately enter alphabetically and numerically information from source documents into our database. Strong typing skills (40+ WPM), attention to detail, and basic computer knowledge required. Reliable attendance is a must."
    },
    {
        reqId: "RCI-FS-44501-1",
        role: "Food Service Worker",
        jd: "Prepare and serve meals in a fast-paced environment. Responsibilities include basic food prep, maintaining kitchen cleanliness, and providing friendly customer service. Ability to follow health and safety guidelines strictly."
    },
    {
        reqId: "RCI-MF-51000-2",
        role: "General Factory Laborer",
        jd: "Operate machinery, assemble products on a production line, and perform quality checks. Must follow all safety protocols, work well in a team, and have the ability to stand for long shifts. No prior experience required; on-the-job training provided."
    },
    {
        reqId: "RCI-HS-62015-4",
        role: "Hospitality Housekeeper",
        jd: "Clean and maintain guest rooms according to established standards. Includes changing linens, vacuuming, and stocking amenities. Eye for detail and reliability are key requirements for this role."
    },
];
