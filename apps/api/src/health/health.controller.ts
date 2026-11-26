import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  database: { status: "up" | "down"; latencyMs?: number };
}

/**
 * Public liveness/readiness endpoint.
 *
 * Deliberately reports 503 when the database is unreachable: a health check
 * that always answers "ok" hides exactly the failure it exists to catch.
 */
@Controller("health")
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    let dbStatus: "up" | "down" = "down";
    let latencyMs: number | undefined;

    const began = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = "up";
      latencyMs = Date.now() - began;
    } catch {
      dbStatus = "down";
    }

    const body: HealthResponse = {
      status: dbStatus === "up" ? "ok" : "degraded",
      service: "desi-jugaad-api",
      version: process.env["npm_package_version"] ?? "0.1.0",
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        ...(latencyMs !== undefined ? { latencyMs } : {}),
      },
    };

    if (dbStatus === "down") {
      throw new ServiceUnavailableException({
        ...body,
        message: "Database unreachable. Is `pnpm db:tunnel` running?",
      });
    }

    return body;
  }
}
