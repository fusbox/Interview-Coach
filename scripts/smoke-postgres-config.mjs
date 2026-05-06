export const SMOKE_POSTGRES = {
    containerName: "interviewcoach-postgres-smoke",
    image: "ankane/pgvector:latest",
    host: "127.0.0.1",
    hostPort: 5434,
    containerPort: 5432,
    user: "postgres",
    password: "interviewcoach-local-smoke-password",
    database: "interviewcoach_smoke",
    applicationName: "interview-coach-smoke",
};

export function getSmokeDatabaseUrl() {
    const {
        user,
        password,
        host,
        hostPort,
        database,
    } = SMOKE_POSTGRES;

    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${hostPort}/${database}`;
}
