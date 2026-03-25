export class HttpError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = options.code ?? "";
    this.details = options.details ?? null;
    this.isOperational = options.isOperational ?? true;
  }
}

export const createHttpError = (statusCode, message, options) =>
  new HttpError(statusCode, message, options);

