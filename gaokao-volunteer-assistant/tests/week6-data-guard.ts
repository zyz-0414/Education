import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parse } from "csv-parse/sync";

type CollegeRow = {
  college_code: string;
  college_name: string;
};

type CollegeGroupRow = {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: string;
  college_code: string;
  group_code: string;
  college_name: string;
};

type GroupBackedRow = {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: string;
  college_code: string;
  group_code: string;
};

function readCsvRows<T>(path: string) {
  return parse(readFileSync(path, "utf-8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as T[];
}

const colleges = readCsvRows<CollegeRow>("data/cleaned/anhui/colleges.csv");
const groups = readCsvRows<CollegeGroupRow>("data/cleaned/anhui/college_groups.csv");
const plans = readCsvRows<GroupBackedRow>("data/cleaned/anhui/enrollment_plans.csv");
const admissions = readCsvRows<GroupBackedRow>("data/cleaned/anhui/admission_results.csv");

const names = {
  pku: "\u5317\u4eac\u5927\u5b66",
  beihua: "\u5317\u534e\u5927\u5b66",
  erwai: "\u5317\u4eac\u7b2c\u4e8c\u5916\u56fd\u8bed\u5b66\u9662",
};

function groupKey(row: GroupBackedRow) {
  return [
    row.year,
    row.province_code,
    row.batch_code,
    row.subject_track,
    row.college_code,
    row.group_code,
  ].join("|");
}

function findGroup(year: string, subjectTrack: string, collegeCode: string, groupCode: string) {
  return groups.find(
    (row) =>
      row.year === year &&
      row.subject_track === subjectTrack &&
      row.college_code === collegeCode &&
      row.group_code === groupCode,
  );
}

function collectNameConflicts(rows: CollegeGroupRow[], getKey: (row: CollegeGroupRow) => string) {
  const namesByKey = new Map<string, Set<string>>();

  for (const row of rows) {
    const key = getKey(row);
    const namesForKey = namesByKey.get(key) ?? new Set<string>();
    namesForKey.add(row.college_name);
    namesByKey.set(key, namesForKey);
  }

  return new Map(Array.from(namesByKey.entries()).filter(([, rowNames]) => rowNames.size > 1));
}

function assertNoSuspiciousCollegeNames(rows: Array<CollegeRow | CollegeGroupRow>) {
  const suspicious = rows.filter((row) => /^\d/.test(row.college_name) || row.college_name.includes("�"));
  assert.deepEqual(
    suspicious.map((row) => `${row.college_code}:${row.college_name}`),
    [],
  );
}

function assertGroupRefs(label: string, rows: GroupBackedRow[]) {
  const groupKeys = new Set(groups.map(groupKey));
  const missing = rows.filter((row) => !groupKeys.has(groupKey(row)));
  assert.deepEqual(
    missing.map(groupKey),
    [],
    `${label} should reference existing college_groups rows`,
  );
}

assert.equal(findGroup("2024", "physics", "1029", "007")?.college_name, names.pku);
assert.equal(findGroup("2025", "physics", "1029", "001")?.college_name, names.beihua);
assert.equal(findGroup("2025", "physics", "1032", "005")?.college_name, names.pku);
assert.equal(findGroup("2025", "physics", "1034", "001")?.college_name, names.erwai);

assertNoSuspiciousCollegeNames(colleges);
assertNoSuspiciousCollegeNames(groups);
assertGroupRefs("enrollment_plans", plans);
assertGroupRefs("admission_results", admissions);

const codeNameConflicts = collectNameConflicts(groups, (row) => row.college_code);
const reused1029Names = codeNameConflicts.get("1029") ?? new Set<string>();
assert.ok(reused1029Names.has(names.pku));
assert.ok(reused1029Names.has(names.beihua));
assert.ok(reused1029Names.size >= 2);

const historyKeyConflicts = collectNameConflicts(groups, (row) =>
  [row.province_code, row.batch_code, row.subject_track, row.college_code, row.group_code].join("|"),
);
assert.ok(
  historyKeyConflicts.has("AH|ordinary_undergraduate|physics|1029|007"),
  "data guard should detect reused history keys that require college_name snapshots",
);

console.log("Week 6 data guard tests OK");
