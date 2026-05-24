export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
