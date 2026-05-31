import { readCsvRows, requiredInt, requiredString } from "./csv";
import { cleanedCsvPaths, sourceIndexPath } from "./paths";

type SourceRow = {
  source_id: string;
};

type SourceBackedRow = {
  source_id: string;
};

type ScoreSegmentRow = SourceBackedRow & {
  year: string;
  province_code: string;
  subject_track: string;
  score: string;
  count: string;
  cumulative_count: string;
  rank_min: string;
  rank_max: string;
};

type CollegeRow = SourceBackedRow & {
  college_code: string;
  college_name: string;
};

type MajorRow = SourceBackedRow & {
  major_code: string;
  major_name: string;
};

type CollegeGroupRow = SourceBackedRow & {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: string;
  college_code: string;
  group_code: string;
};

type EnrollmentPlanRow = SourceBackedRow & {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: string;
  college_code: string;
  group_code: string;
  major_code: string;
  plan_count: string;
};

type AdmissionResultRow = SourceBackedRow & {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: string;
  college_code: string;
  group_code: string;
};

type CharterRuleRow = SourceBackedRow & {
  year: string;
  college_code: string;
  scope_type: string;
  rule_type: string;
  original_text: string;
};

export type CsvValidationSummary = {
  rows: Record<string, number>;
  warnings: string[];
};

function key(parts: Array<string | number>) {
  return parts.join("|");
}

function findDuplicates<T>(rows: T[], getKey: (row: T) => string): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const rowKey = getKey(row);
    counts.set(rowKey, (counts.get(rowKey) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([rowKey]) => rowKey);
}

function assertNoDuplicates(label: string, duplicates: string[]) {
  if (duplicates.length > 0) {
    throw new Error(`${label} has duplicate keys: ${duplicates.slice(0, 5).join(", ")}`);
  }
}

function assertSourceIds(label: string, rows: SourceBackedRow[], sourceIds: Set<string>) {
  const missing = rows
    .map((row) => row.source_id)
    .filter((sourceId) => sourceId && !sourceIds.has(sourceId));

  if (missing.length > 0) {
    throw new Error(`${label} has unknown source_id values: ${Array.from(new Set(missing)).join(", ")}`);
  }
}

function assertGroupRefs(
  label: string,
  rows: Array<CollegeGroupRow | EnrollmentPlanRow | AdmissionResultRow>,
  groupKeys: Set<string>,
) {
  const missing = rows
    .map((row) =>
      key([
        requiredInt(row.year, "year"),
        requiredString(row.province_code, "province_code"),
        requiredString(row.batch_code, "batch_code"),
        requiredString(row.subject_track, "subject_track"),
        requiredString(row.college_code, "college_code"),
        requiredString(row.group_code, "group_code"),
      ]),
    )
    .filter((rowKey) => !groupKeys.has(rowKey));

  if (missing.length > 0) {
    throw new Error(`${label} references missing college_group keys: ${Array.from(new Set(missing)).slice(0, 5).join(", ")}`);
  }
}

function assertCollegeRefs(
  label: string,
  rows: Array<CollegeGroupRow | EnrollmentPlanRow | AdmissionResultRow | CharterRuleRow>,
  collegeCodes: Set<string>,
) {
  const missing = rows
    .map((row) => requiredString(row.college_code, "college_code"))
    .filter((collegeCode) => !collegeCodes.has(collegeCode));

  if (missing.length > 0) {
    throw new Error(`${label} references missing college codes: ${Array.from(new Set(missing)).slice(0, 5).join(", ")}`);
  }
}

function validateScoreSegments(rows: ScoreSegmentRow[]) {
  for (const row of rows) {
    const count = requiredInt(row.count, "count");
    const cumulativeCount = requiredInt(row.cumulative_count, "cumulative_count");
    const rankMin = requiredInt(row.rank_min, "rank_min");
    const rankMax = requiredInt(row.rank_max, "rank_max");

    if (rankMin !== cumulativeCount - count + 1 || rankMax !== cumulativeCount) {
      throw new Error(
        `score_segments rank interval mismatch: ${row.year}/${row.subject_track}/${row.score}`,
      );
    }
  }
}

export async function validateWeek3Csv(): Promise<CsvValidationSummary> {
  const sources = await readCsvRows<SourceRow>(sourceIndexPath);
  const scoreSegments = await readCsvRows<ScoreSegmentRow>(cleanedCsvPaths.scoreSegments);
  const colleges = await readCsvRows<CollegeRow>(cleanedCsvPaths.colleges);
  const majors = await readCsvRows<MajorRow>(cleanedCsvPaths.majors);
  const collegeGroups = await readCsvRows<CollegeGroupRow>(cleanedCsvPaths.collegeGroups);
  const enrollmentPlans = await readCsvRows<EnrollmentPlanRow>(cleanedCsvPaths.enrollmentPlans);
  const admissionResults = await readCsvRows<AdmissionResultRow>(cleanedCsvPaths.admissionResults);
  const charterRules = await readCsvRows<CharterRuleRow>(cleanedCsvPaths.charterRules);

  const sourceIds = new Set(sources.map((row) => requiredString(row.source_id, "source_id")));
  const collegeCodes = new Set(colleges.map((row) => requiredString(row.college_code, "college_code")));
  const groupKeys = new Set(
    collegeGroups.map((row) =>
      key([
        requiredInt(row.year, "year"),
        requiredString(row.province_code, "province_code"),
        requiredString(row.batch_code, "batch_code"),
        requiredString(row.subject_track, "subject_track"),
        requiredString(row.college_code, "college_code"),
        requiredString(row.group_code, "group_code"),
      ]),
    ),
  );

  assertNoDuplicates(
    "score_segments",
    findDuplicates(scoreSegments, (row) =>
      key([
        requiredInt(row.year, "year"),
        requiredString(row.province_code, "province_code"),
        requiredString(row.subject_track, "subject_track"),
        requiredInt(row.score, "score"),
      ]),
    ),
  );
  assertNoDuplicates(
    "college_groups",
    findDuplicates(collegeGroups, (row) =>
      key([
        requiredInt(row.year, "year"),
        requiredString(row.province_code, "province_code"),
        requiredString(row.batch_code, "batch_code"),
        requiredString(row.subject_track, "subject_track"),
        requiredString(row.college_code, "college_code"),
        requiredString(row.group_code, "group_code"),
      ]),
    ),
  );
  assertNoDuplicates(
    "enrollment_plans",
    findDuplicates(enrollmentPlans, (row) =>
      key([
        requiredInt(row.year, "year"),
        requiredString(row.province_code, "province_code"),
        requiredString(row.batch_code, "batch_code"),
        requiredString(row.subject_track, "subject_track"),
        requiredString(row.college_code, "college_code"),
        requiredString(row.group_code, "group_code"),
        requiredString(row.major_code, "major_code"),
      ]),
    ),
  );
  assertNoDuplicates(
    "admission_results",
    findDuplicates(admissionResults, (row) =>
      key([
        requiredInt(row.year, "year"),
        requiredString(row.province_code, "province_code"),
        requiredString(row.batch_code, "batch_code"),
        requiredString(row.subject_track, "subject_track"),
        requiredString(row.college_code, "college_code"),
        requiredString(row.group_code, "group_code"),
      ]),
    ),
  );

  validateScoreSegments(scoreSegments);

  for (const [label, rows] of [
    ["score_segments", scoreSegments],
    ["colleges", colleges],
    ["majors", majors],
    ["college_groups", collegeGroups],
    ["enrollment_plans", enrollmentPlans],
    ["admission_results", admissionResults],
    ["charter_rules", charterRules],
  ] as const) {
    assertSourceIds(label, rows, sourceIds);
  }

  assertCollegeRefs("college_groups", collegeGroups, collegeCodes);
  assertCollegeRefs("enrollment_plans", enrollmentPlans, collegeCodes);
  assertCollegeRefs("admission_results", admissionResults, collegeCodes);
  assertCollegeRefs("charter_rules", charterRules, collegeCodes);
  assertGroupRefs("enrollment_plans", enrollmentPlans, groupKeys);
  assertGroupRefs("admission_results", admissionResults, groupKeys);

  return {
    rows: {
      sources: sources.length,
      scoreSegments: scoreSegments.length,
      colleges: colleges.length,
      majors: majors.length,
      collegeGroups: collegeGroups.length,
      enrollmentPlans: enrollmentPlans.length,
      admissionResults: admissionResults.length,
      charterRules: charterRules.length,
    },
    warnings: [],
  };
}
