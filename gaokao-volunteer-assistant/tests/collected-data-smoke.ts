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

assert.ok(plans.length > 45_000, "collected plan data should replace the old sample rows");
assert.ok(groups.length > 9_000, "college groups should cover full 2024-2025 ordinary undergraduate data");
assert.ok(admissions.length > 8_000, "admission rows should include 2024 and 2025 group投档线");

assert.ok((planCounts.get("2025|physics") ?? 0) > 18_000, "2025 physics plans should be full-scale");
assert.ok((planCounts.get("2025|history") ?? 0) > 5_000, "2025 history plans should be full-scale");
assert.ok((admissionCounts.get("2024|history") ?? 0) > 1_000, "2024 history admissions should be parsed");
assert.ok((admissionCounts.get("2025|physics") ?? 0) > 3_000, "2025 physics admissions should be parsed");

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
  "src_collected_ah_2024_enrollment_plan",
  "src_collected_ah_2025_enrollment_plan",
  "src_collected_ah_2024_group_admission",
  "src_collected_ah_2025_group_admission",
]) {
  assert.ok(sourceIds.has(expected), `missing source index row: ${expected}`);
}

console.log("Collected Anhui data smoke tests OK");
