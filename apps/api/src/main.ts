import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// The workspace `.env` lives at the repository root; this app runs from apps/api.
for (const candidate of [".env", "../../.env"]) {
  loadEnv({ path: path.resolve(process.cwd(), candidate) });
}

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.setGlobalPrefix("api/v1");

  // Express's default ETags make GETs revalidate with If-None-Match; some
  // proxies replay those 304s without a body and the client parses an empty
  // payload. JSON APIs here are never cacheable, so ETags are off entirely.
  app.getHttpAdapter().getInstance().set("etag", false);

  app.use(cookieParser());

  const origins = (process.env["API_CORS_ORIGINS"] ?? "http://localhost:8081")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // API responses are per-session JSON: never let the browser cache them.
  // Express's default ETags otherwise trigger conditional requests whose 304
  // replay can arrive without a body through some proxies, which the client
  // then parses as an empty payload.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // `whitelist` strips unknown keys so a stray field can never reach Prisma.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  app.enableShutdownHooks();

  // API_HOST comes from the environment (documented in .env.example):
  //   dev keeps 0.0.0.0 so phones on the LAN can reach it;
  //   production sets 127.0.0.1 so the API is only reachable through Caddy.
  const host = process.env["API_HOST"] ?? "0.0.0.0";
  const port = Number(process.env["API_PORT"] ?? 4000);
  await app.listen(port, host);

  Logger.log(`API listening on http://${host}:${port}/api/v1`, "Bootstrap");
  Logger.log(
    `CORS origins: ${origins.join(", ")}`,
    "Bootstrap",
  );
}

void bootstrap();
