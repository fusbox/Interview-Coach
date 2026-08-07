import { EmployeeWorkspaceLoading } from "@/features/recruiter-auth-v2/EmployeeWorkspaceLoading";

export default function RecruiterLoading() {
    return (
        <EmployeeWorkspaceLoading
            accessibleLabel="Loading recruiter workspace"
            statusText="Loading recruiter workspace."
        />
    );
}
