import { EmployeeWorkspaceLoading } from "@/features/recruiter-auth-v2/EmployeeWorkspaceLoading";

export default function AdminLoading() {
    return (
        <EmployeeWorkspaceLoading
            accessibleLabel="Loading administrator workspace"
            statusText="Loading administrator workspace."
            includeShellPlaceholder
        />
    );
}
