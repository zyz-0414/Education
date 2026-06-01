import { PrismaClient } from "@prisma/client";

import { importWeek3Data } from "../../src/lib/data-import/week3";

const prisma = new PrismaClient();

async function main() {
  const [scoreSegments, collegeGroups] = await Promise.all([
    prisma.scoreSegment.count(),
    prisma.collegeGroup.count(),
  ]);

  if (scoreSegments > 0 && collegeGroups > 0) {
    console.log(
      `Local database already has data: scoreSegments=${scoreSegments}, collegeGroups=${collegeGroups}`,
    );
    return;
  }

  console.log("Local database is empty or incomplete. Importing prepared CSV data...");
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
