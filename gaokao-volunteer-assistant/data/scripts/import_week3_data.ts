import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { importWeek3Data } from "../../src/lib/data-import/week3";

const prisma = new PrismaClient();

async function main() {
  const summary = await importWeek3Data(prisma);
  console.table(summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
