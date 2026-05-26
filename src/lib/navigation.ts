export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};

export const suiteLinks: NavItem[] = [
  {
    label: "Back to RangamWorks",
    href: "https://rangamworks.com/job-seeker/dashboard",
    external: true
  },
  {
    label: "Resume Builder",
    href: "https://resumebuilder.rangamworks.com",
    external: true
  },
  {
    label: "Interview Coach",
    href: "/"
  },
  {
    label: "Job Auto-Applicant",
    href: "https://autoapplicant.rangamworks.com",
    external: true
  }
];

export const coachLinks: NavItem[] = [
  {
    label: "Practice",
    href: "/practice"
  },
  {
    label: "Dashboard",
    href: "/dashboard"
  },
  {
    label: "Summary",
    href: "/summary"
  }
];

export const mobileCoachLinks: NavItem[] = [
  suiteLinks[0],
  suiteLinks[2],
  coachLinks[0],
  coachLinks[1]
];
