import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parse } from "csv-parse/sync";

type Row = Record<string, string>;

function readCsv(path: string) {
  return parse(readFileSync(path, "utf-8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as Row[];
}

function countBy(rows: Row[], fieldNames: string[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = fieldNames.map((fieldName) => row[fieldName]).join("|");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const groups = readCsv("data/cleaned/anhui/college_groups.csv");
const plans = readCsv("data/cleaned/anhui/enrollment_plans.csv");
const admissions = readCsv("data/cleaned/anhui/admission_results.csv");
const sources = readCsv("data/sources/source_index.csv");

const planCounts = countBy(plans, ["year", "subject_track"]);
const admissionCounts = countBy(admissions, ["year", "subject_track"]);

assert.ok(plans.length > 70_000, "collected plan data should include 2024-2026 full-scale rows");
assert.ok(groups.length > 16_000, "college groups should cover 2024-2026 groups and 2023 legacy references");
assert.ok(admissions.length > 10_000, "admission rows should include 2024-2025 group lines and 2023 legacy lines");

assert.ok((planCounts.get("2025|physics") ?? 0) > 18_000, "2025 physics plans should be full-scale");
assert.ok((planCounts.get("2025|history") ?? 0) > 5_000, "2025 history plans should be full-scale");
assert.ok((planCounts.get("2026|physics") ?? 0) > 19_000, "2026 physics plans should be full-scale");
assert.ok((planCounts.get("2026|history") ?? 0) > 6_000, "2026 history plans should be full-scale");
assert.equal(
  admissions.some((row) => row.year === "2026"),
  false,
  "2026 admission results should not be synthesized before official投档线 is available",
);
assert.ok((admissionCounts.get("2024|history") ?? 0) > 1_000, "2024 history admissions should be parsed");
assert.ok((admissionCounts.get("2025|physics") ?? 0) > 3_000, "2025 physics admissions should be parsed");
assert.ok((admissionCounts.get("2023|physics") ?? 0) > 1_000, "2023 science admissions should map to physics");
assert.ok((admissionCounts.get("2023|history") ?? 0) > 800, "2023 liberal arts admissions should map to history");
assert.equal(
  admissions.some((row) => row.year === "2023" && row.group_code !== "000"),
  false,
  "2023 legacy admissions should use the synthetic legacy group code",
);

assert.equal(
  plans.some((row) => row.source_id === "src_csiic_2025_anhui_plan_sample"),
  false,
  "sample enrollment plan source should not remain in cleaned plans",
);

const dirtyRequirements = groups
  .map((row) => row.subject_requirement)
  .filter((value) => /首选|化学学|生物物|思想思想|地理理/.test(value));
assert.deepEqual(dirtyRequirements.slice(0, 5), [], "subject requirements should be normalized");

const sourceIds = new Set(sources.map((row) => row.source_id));
for (const expected of [
  "src_collected_ah_2023_score_segments",
  "src_collected_ah_2023_legacy_admission",
  "src_collected_ah_2024_enrollment_plan",
  "src_collected_ah_2025_enrollment_plan",
  "src_collected_ah_2026_enrollment_plan",
  "src_collected_ah_2024_group_admission",
  "src_collected_ah_2025_group_admission",
]) {
  assert.ok(sourceIds.has(expected), `missing source index row: ${expected}`);
}

console.log("Collected Anhui data smoke tests OK");
