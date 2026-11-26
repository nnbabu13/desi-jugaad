import "dotenv/config";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Application-wide Prisma client.
 *
 * Prisma 7 uses the Rust-free query compiler, so the client needs a driver
 * adapter (`@prisma/adapter-pg`) plus a connection string rather than the
 * `url` that used to live in `datasource db`.
 *
 * The connection string normally points at `localhost:1521`, which is an SSH
 * tunnel to the remote PostgreSQL (see scripts/start-db-tunnel.ps1).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:tunnel`.",
      );
    }
    super({
      adapter: new PrismaPg({ connectionString }),
      log:
        process.env["NODE_ENV"] === "production"
          ? ["error", "warn"]
          : ["error", "warn"],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
