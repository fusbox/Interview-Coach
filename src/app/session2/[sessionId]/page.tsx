import { redirect } from "next/navigation";

export default async function Session2Page({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    redirect(`/candidate/session/${encodeURIComponent(sessionId)}`);
}
