export class InviteAccessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InviteAccessError";
    }
}

export class InviteInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InviteInputError";
    }
}
