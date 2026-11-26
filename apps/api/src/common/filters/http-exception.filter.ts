import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Normalises every `HttpException` into a single, predictable envelope so the
 * mobile and web clients can render one error shape:
 *
 *   { statusCode, error, message, details?, timestamp, path }
 *
 * `details` carries field-level validation errors for form rendering.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const payload = exception.getResponse();

    let error = exception.name;
    let message: string | string[] = exception.message;
    let details: unknown;

    if (typeof payload === "object" && payload !== null) {
      const body = payload as Record<string, unknown>;
      if (typeof body["error"] === "string") error = body["error"];
      if (typeof body["message"] === "string" || Array.isArray(body["message"])) {
        message = body["message"] as string | string[];
      }
      if (body["details"] !== undefined) details = body["details"];
    }

    // Never leak internals in production error responses.
    if (status >= 500 && process.env["NODE_ENV"] === "production") {
      message = "Something went wrong. Please try again.";
      details = undefined;
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

export const statusFromUnknown = (value: unknown): number =>
  value instanceof HttpException
    ? value.getStatus()
    : HttpStatus.INTERNAL_SERVER_ERROR;
