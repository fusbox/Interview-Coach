import { OperationsAlert } from "@/lib/server/alerts";
import { getOptionalServerEnv } from "@/lib/server/config/server-env";

export type TeamsAlertDeliveryStatus =
    | "sent"
    | "no_triggered_alerts"
    | "webhook_not_configured";

export type TeamsAlertDeliveryResult = {
    status: TeamsAlertDeliveryStatus;
    triggeredAlertIds: string[];
    deliveredAlertIds: string[];
};

type TeamsMessageFact = {
    name: string;
    value: string;
};

type TeamsMessageCard = {
    "@type": "MessageCard";
    "@context": "https://schema.org/extensions";
    summary: string;
    themeColor: string;
    title: string;
    sections: Array<{
        activityTitle: string;
        activitySubtitle: string;
        text: string;
        facts: TeamsMessageFact[];
        markdown: true;
    }>;
    potentialAction: Array<{
        "@type": "OpenUri";
        name: string;
        targets: Array<{
            os: "default";
            uri: string;
        }>;
    }>;
};

function getTeamsThemeColor(alerts: OperationsAlert[]): string {
    return alerts.some((alert) => alert.severity === "critical") ? "C62828" : "FFB300";
}

function buildAlertFacts(alert: OperationsAlert): TeamsMessageFact[] {
    const metadataFacts = Object.entries(alert.metadata)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => ({
            name,
            value: String(value)
        }));

    return [
        { name: "Alert ID", value: alert.id },
        { name: "Severity", value: alert.severity.toUpperCase() },
        { name: "Routes", value: alert.routes.join(", ") },
        { name: "Runbook", value: alert.runbookSlug },
        ...metadataFacts
    ];
}

export function buildTeamsAlertCard(options: {
    alerts: OperationsAlert[];
    correlationId: string;
    metricsUrl: string;
}): TeamsMessageCard {
    const triggeredAlerts = options.alerts.filter((alert) => alert.triggered);

    return {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        summary: `Interview Coach ops alerts triggered: ${triggeredAlerts.map((alert) => alert.title).join(", ")}`,
        themeColor: getTeamsThemeColor(triggeredAlerts),
        title: `Interview Coach alert notification (${triggeredAlerts.length})`,
        sections: triggeredAlerts.map((alert) => ({
            activityTitle: alert.title,
            activitySubtitle: `${alert.severity.toUpperCase()} | correlation ${options.correlationId}`,
            text: alert.summary,
            facts: buildAlertFacts(alert),
            markdown: true as const
        })),
        potentialAction: [
            {
                "@type": "OpenUri",
                name: "Open Ops Metrics",
                targets: [
                    {
                        os: "default",
                        uri: options.metricsUrl
                    }
                ]
            }
        ]
    };
}

export async function sendTriggeredAlertsToTeams(options: {
    alerts: OperationsAlert[];
    correlationId: string;
    metricsUrl: string;
}): Promise<TeamsAlertDeliveryResult> {
    const triggeredAlerts = options.alerts.filter((alert) => alert.triggered);
    const triggeredAlertIds = triggeredAlerts.map((alert) => alert.id);

    if (triggeredAlerts.length === 0) {
        return {
            status: "no_triggered_alerts",
            triggeredAlertIds,
            deliveredAlertIds: []
        };
    }

    const webhookUrl = getOptionalServerEnv("TEAMS_ALERT_WEBHOOK_URL");
    if (!webhookUrl) {
        return {
            status: "webhook_not_configured",
            triggeredAlertIds,
            deliveredAlertIds: []
        };
    }

    const card = buildTeamsAlertCard({
        alerts: triggeredAlerts,
        correlationId: options.correlationId,
        metricsUrl: options.metricsUrl
    });

    // This route intentionally sends only the current triggered window. If the team automates
    // this via cron or background workers later, add dedupe/persistence first to avoid repeats.
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(card)
    });

    if (!response.ok) {
        throw new Error(`Teams webhook notification failed with status ${response.status}.`);
    }

    return {
        status: "sent",
        triggeredAlertIds,
        deliveredAlertIds: triggeredAlertIds
    };
}
