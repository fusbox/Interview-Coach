"use client"

import type { Tour } from "@/components/ui/tour"

export const RECRUITER_CREATE_INVITE_TOUR_ID = "recruiter-create-invite"

export const recruiterTours = [
    {
        id: RECRUITER_CREATE_INVITE_TOUR_ID,
        steps: [
            {
                id: "tour-recruiter-settings-profile",
                title: "Set Up Your Profile",
                content: (
                    <p>
                        Add your details that will appear in candidate invite emails so
                        your outreach feels complete and trustworthy.
                    </p>
                ),
                placement: "anchored",
                mobilePlacement: "stacked",
                side: "right",
                align: "start",
            },
            {
                id: "tour-recruiter-settings-save",
                title: "Save And Continue",
                content: (
                    <p>
                        If you haven&apos;t already, save your profile details and click
                        &nbsp;&quot;Continue to Create Invite&quot;.
                    </p>
                ),
                placement: "anchored",
                mobilePlacement: "anchored",
                nextLabel: "Continue to Create Invite",
                nextRoute: "/recruiter/create",
                side: "top",
                align: "end",
            },
            {
                id: "tour-recruiter-create-wizard",
                title: "Invite Builder",
                content: (
                    <p>
                        This flow is split into three stages: define the role, add candidates, and
                        review the invite before sending.
                    </p>
                ),
                placement: "below",
                mobilePlacement: "below",
                showPrevious: false,
                side: "bottom",
                align: "center",
            },
            {
                id: "tour-recruiter-create-job-details",
                title: "Role Details",
                content: (
                    <p>
                        We&apos;ve prefilled sample content for this demo. When you configure a real
                        session, you&apos;ll copy the Req ID, Target Role, and Job Description from
                        TalentArbor.
                    </p>
                ),
                side: "bottom",
                align: "start",
            },
            {
                id: "tour-recruiter-create-questions",
                title: "Question Sets",
                content: (
                    <p>
                        We&apos;ve prefilled sample questions for this demo. In your normal flow,
                        you&apos;ll typically paste these questions from TalentArbor.
                    </p>
                ),
                side: "top",
                align: "center",
            },
            {
                id: "tour-recruiter-create-ai-generate",
                title: "AI Question Generation",
                content: (
                    <p>
                        Or you can use AI to generate a first pass from the role and job
                        description.
                    </p>
                ),
                scrollBehavior: "none",
                side: "bottom",
                align: "start",
            },
            {
                id: "tour-recruiter-create-candidates",
                title: "Candidate Details",
                content: (
                    <p>
                        Add one or many candidates here. The tour drops in a sample candidate so
                        you can immediately see how the rest of the flow behaves.
                    </p>
                ),
                side: "bottom",
                align: "center",
            },
            {
                id: "tour-recruiter-create-resume",
                title: "Resume Context",
                content: (
                    <p>
                        Resume content helps tailor the practice session and usually leads to much
                        stronger coaching. If the resume is available, it&apos;s highly recommended
                        that you include it.
                    </p>
                ),
                placement: "anchored",
                mobilePlacement: "anchored",
                mobileMatchTargetWidth: true,
                side: "bottom",
                align: "start",
            },
            {
                id: "tour-recruiter-create-preview",
                title: "Review Before Sending",
                content: (
                    <p>
                        This screen lets you confirm the role, questions, and candidate list before
                        opening the invite preview.
                    </p>
                ),
                placement: "anchored",
                mobilePlacement: "stacked",
                side: "right",
                align: "start",
            },
            {
                id: "tour-recruiter-create-preview-modal",
                title: "Invite Preview",
                content: (
                    <p>
                        This is the final pre-send check. In this demonstration, we stop here. In
                        the real flow, use Send to deliver the invite, or Cancel to return and
                        revise the details first.
                    </p>
                ),
                placement: "anchored",
                mobilePlacement: "stacked",
                scrollBehavior: "none",
                cardWidth: 320,
                nextLabel: "Finish Tour",
                side: "right",
                align: "start",
            },
        ],
    },
] satisfies Tour[]
