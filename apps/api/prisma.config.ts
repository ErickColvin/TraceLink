import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"];

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/contract.prisma",
    ...(databaseUrl === undefined
      ? {}
      : {
          db: {
            connection: databaseUrl,
          },
        }),
  }),
});
