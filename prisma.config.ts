/// <reference types="node" />

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});