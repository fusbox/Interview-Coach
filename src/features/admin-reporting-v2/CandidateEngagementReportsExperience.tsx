import { Activity, Clock3, DatabaseZap, Layers3 } from "lucide-react";

import type { CandidateEngagementReportRow } from "@/features/candidate-engagement-v2/candidate-engagement-contract";
import styles from "./CandidateEngagementReportsExperience.module.css";

export function CandidateEngagementReportsExperience({
    rows,
    unavailable = false,
}: {
    rows: CandidateEngagementReportRow[];
    unavailable?: boolean;
}) {
    const totalActiveMilliseconds = rows.reduce((total, row) => total + row.activeMilliseconds, 0);
    const totalSliceCount = rows.reduce((total, row) => total + row.sliceCount, 0);

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className="type-eyebrow">Internal reporting</p>
                    <h1>Candidate engagement</h1>
                    <p>Active practice time recorded from candidate-led V2 sessions.</p>
                </div>
                <span className={styles.posture}>Privacy-minimized</span>
            </header>

            <section className={styles.summary} aria-label="Engagement summary">
                <ReportMetric icon={<Clock3 aria-hidden="true" />} label="Active time" value={formatDuration(totalActiveMilliseconds)} />
                <ReportMetric icon={<Activity aria-hidden="true" />} label="Sessions tracked" value={String(rows.length)} />
                <ReportMetric icon={<Layers3 aria-hidden="true" />} label="Slices received" value={String(totalSliceCount)} />
            </section>

            <section className={styles.report} aria-labelledby="engagement-report-title">
                <div className={styles.reportHeader}>
                    <div>
                        <p className="type-eyebrow">Session ledger</p>
                        <h2 id="engagement-report-title">Recent engagement</h2>
                    </div>
                    <span>{rows.length} session{rows.length === 1 ? "" : "s"}</span>
                </div>

                {unavailable ? (
                    <ReportNotice
                        title="Engagement reporting is unavailable"
                        detail="The page could not read the reporting ledger. Candidate practice remains available."
                    />
                ) : rows.length === 0 ? (
                    <ReportNotice
                        title="No engagement has been recorded yet"
                        detail="Candidate-led sessions appear here after the engagement migration and runtime flag are enabled."
                    />
                ) : (
                    <div className={styles.tableViewport}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th scope="col">Candidate</th>
                                    <th scope="col">Practice context</th>
                                    <th scope="col">Active time</th>
                                    <th scope="col">Slices</th>
                                    <th scope="col">Last recorded</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.candidatePracticeSessionId}>
                                        <td data-label="Candidate">
                                            <strong>{row.candidateLabel}</strong>
                                            <span>{row.maskedEmail}</span>
                                        </td>
                                        <td data-label="Practice context">
                                            <strong>{row.targetRole}</strong>
                                            <span>{formatStatus(row.sessionStatus)} · started {formatDate(row.sessionCreatedAt)}</span>
                                        </td>
                                        <td data-label="Active time"><strong>{formatDuration(row.activeMilliseconds)}</strong></td>
                                        <td data-label="Slices">{row.sliceCount}</td>
                                        <td data-label="Last recorded">{formatDate(row.lastReceivedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}

function ReportMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <article className={styles.metric}>
            <span className={styles.metricIcon}>{icon}</span>
            <div>
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
        </article>
    );
}

function ReportNotice({ title, detail }: { title: string; detail: string }) {
    return (
        <div className={styles.notice}>
            <DatabaseZap aria-hidden="true" />
            <div>
                <h3>{title}</h3>
                <p>{detail}</p>
            </div>
        </div>
    );
}

export function formatDuration(milliseconds: number) {
    const totalSeconds = Math.max(0, Math.round(milliseconds / 1_000));
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatDate(value: string | null) {
    if (!value) return "Not available";
    const date = new Date(value);
    if (!Number.isFinite(date.valueOf())) return "Not available";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function formatStatus(value: CandidateEngagementReportRow["sessionStatus"]) {
    return value.replaceAll("_", " ");
}
