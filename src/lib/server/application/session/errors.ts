export class SessionStartAccessError extends Error {
    status: 401 | 403;

    constructor(message: string, status: 401 | 403) {
        super(message);
        this.name = "SessionStartAccessError";
        this.status = status;
    }
}

export class SessionStartNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SessionStartNotFoundError";
    }
}
