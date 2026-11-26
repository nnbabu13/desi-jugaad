// Prisma ORM 7 configuration.
//
// Prisma 7.10+ names this file `prisma7.config.ts` so it cannot clash with the
// Prisma 8 config format (`prisma.config.ts`); the v7 CLI discovers either name.
//
// The Prisma CLI runs from `apps/api`, but the workspace `.env` lives at the
// repository root, so we load both locations (dotenv never overrides a value
// that is already set, so the nearest file wins).
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

for (const candidate of [".env", "../../.env"]) {
  loadEnv({ path: path.resolve(process.cwd(), candidate) });
}

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the repository root and run `pnpm db:tunnel` first.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
