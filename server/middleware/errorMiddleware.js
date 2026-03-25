import { HttpError } from "../utils/httpError.js";

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export const notFoundHandler = (req, _res, next) =>
  next(
    new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`, {
      code: "ROUTE_NOT_FOUND",
    })
  );

export const errorHandler = (error, _req, res, _next) => {
  const isHttpError = error instanceof HttpError;
  const statusCode =
    isHttpError && Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;

  const responseBody = {
    message:
      statusCode === 500 ? "Something went wrong on the server." : error.message,
  };

  if (isHttpError && error.code) {
    responseBody.code = error.code;
  }

  if (isHttpError && error.details != null) {
    responseBody.details = error.details;
  }

  if (statusCode === 500 && process.env.NODE_ENV !== "test") {
    console.error("Unhandled server error:", error);
  }

  return res.status(statusCode).json(responseBody);
};

