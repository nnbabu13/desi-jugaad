import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Catches everything that is not an `HttpException` (Prisma errors, network
 * failures, programmer errors) and returns a generic 500 without leaking stack
 * traces or SQL to the client.
 *
 * A small set of Prisma errors is translated into meaningful HTTP statuses
 * because unique-constraint and not-found failures are normal product flows.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.translate(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? "Error",
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private translate(exception: unknown): { status: number; message: string } {
    const code = this.prismaCode(exception);

    switch (code) {
      case "P2002":
        return {
          status: HttpStatus.CONFLICT,
          message: "That value is already taken.",
        };
      case "P2025":
        return { status: HttpStatus.NOT_FOUND, message: "Record not found." };
      case "P2003":
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "A referenced record does not exist.",
        };
      case "P2021":
      case "P2022":
        return { status: HttpStatus.NOT_FOUND, message: "Record not found." };
    }

    if (exception instanceof Error && exception.message.includes("ECONNREFUSED")) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: "Database unavailable. Check that the DB tunnel is running.",
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Something went wrong. Please try again.",
    };
  }

  private prismaCode(exception: unknown): string | undefined {
    if (typeof exception !== "object" || exception === null) return undefined;
    const maybe = exception as { code?: unknown; meta?: unknown };
    return typeof maybe.code === "string" ? maybe.code : undefined;
  }
}
