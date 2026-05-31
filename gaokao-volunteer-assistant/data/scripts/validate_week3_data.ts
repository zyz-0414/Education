import { validateWeek3Csv } from "../../src/lib/data-import/validate-week3";

async function main() {
  const summary = await validateWeek3Csv();
  console.table(summary.rows);
  console.log("Week 3 CSV integrity OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
