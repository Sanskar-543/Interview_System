export class AppError extends Error {
    code;
    status;
    constructor(code, message, status = 500) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.status = status;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
