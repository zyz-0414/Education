import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parse } from "csv-parse/sync";

import { calculateReferenceRank, type HistoricalRank } from "@/lib/recommend/rank-model";
import { getTierByRankGap, type RecommendationTier } from "@/lib/recommend/tier";

type SubjectTrack = "physics" | "history";

type GroupBackedRow = {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: SubjectTrack;
  college_code: string;
  group_code: string;
};

type CollegeGroupRow = GroupBackedRow & {
  college_name: string;
  subject_requirement: string;
};

type AdmissionRow = GroupBackedRow & {
  major_code: string;
  min_score: string;
  min_rank: string;
};

type PlanRow = GroupBackedRow & {
  plan_count: string;
};

type BacktestItem = {
  subjectTrack: SubjectTrack;
  collegeName: string;
  collegeCode: string;
  groupCode: string;
  predictedRank: number;
  actualRank: number;
  absErrorRatio: number;
  tierAtActualLine: RecommendationTier;
  hasLegacyReference: boolean;
};

type BacktestSummary = {
  count: number;
  withLegacyReference: number;
  medianAbsErrorRatio: number;
  p75AbsErrorRatio: number;
  p90AbsErrorRatio: number;
  within12Ratio: number;
  within20Ratio: number;
  within30Ratio: number;
  recommendedEnvelopeRatio: number;
  tierCounts: Record<RecommendationTier, number>;
};

const TARGET_YEAR = "2025";
const TRAINING_GROUP_YEAR = "2024";
const LEGACY_REFERENCE_YEAR = "2023";

function readCsvRows<T>(path: string) {
  return parse(readFileSync(path, "utf-8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as T[];
}

function normalizeCollegeName(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, "");
}

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

function identityKey(row: GroupBackedRow, collegeName: string | undefined) {
  return [
    row.province_code,
    row.batch_code,
    row.subject_track,
    row.college_code,
    row.group_code,
    normalizeCollegeName(collegeName),
  ].join("|");
}

function yearIdentityKey(row: GroupBackedRow, collegeName: string | undefined) {
  return `${row.year}|${identityKey(row, collegeName)}`;
}

function chooseAdmissionLine(rows: AdmissionRow[]) {
  const usableRows = rows.filter((row) => Number(row.min_rank) > 0);

  return [...usableRows].sort((a, b) => {
    if (!a.major_code && b.major_code) return -1;
    if (a.major_code && !b.major_code) return 1;

    return Number(b.min_rank) - Number(a.min_rank);
  })[0] ?? null;
}

function percentile(values: number[], ratio: number) {
  assert.ok(values.length > 0, "percentile requires at least one value");

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
}

function emptyTierCounts(): Record<RecommendationTier, number> {
  return {
    reach: 0,
    match: 0,
    safe: 0,
    very_safe: 0,
    high_risk: 0,
  };
}

function summarize(items: BacktestItem[]): BacktestSummary {
  const absErrors = items.map((item) => item.absErrorRatio);
  const tierCounts = emptyTierCounts();

  for (const item of items) {
    tierCounts[item.tierAtActualLine] += 1;
  }

  const recommendedEnvelopeCount = tierCounts.reach + tierCounts.match + tierCounts.safe;

  return {
    count: items.length,
    withLegacyReference: items.filter((item) => item.hasLegacyReference).length,
    medianAbsErrorRatio: percentile(absErrors, 0.5),
    p75AbsErrorRatio: percentile(absErrors, 0.75),
    p90AbsErrorRatio: percentile(absErrors, 0.9),
    within12Ratio: items.filter((item) => item.absErrorRatio <= 0.12).length / items.length,
    within20Ratio: items.filter((item) => item.absErrorRatio <= 0.2).length / items.length,
    within30Ratio: items.filter((item) => item.absErrorRatio <= 0.3).length / items.length,
    recommendedEnvelopeRatio: recommendedEnvelopeCount / items.length,
    tierCounts,
  };
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const groups = readCsvRows<CollegeGroupRow>("data/cleaned/anhui/college_groups.csv");
const admissions = readCsvRows<AdmissionRow>("data/cleaned/anhui/admission_results.csv");
const plans = readCsvRows<PlanRow>("data/cleaned/anhui/enrollment_plans.csv");

const groupsByKey = new Map(groups.map((row) => [groupKey(row), row]));

function getCollegeName(row: GroupBackedRow) {
  return groupsByKey.get(groupKey(row))?.college_name;
}

const admissionsByYearIdentity = new Map<string, AdmissionRow[]>();
const legacyAdmissionsBySubjectCollege = new Map<string, AdmissionRow[]>();
const planCountsByYearIdentity = new Map<string, number>();

for (const row of admissions) {
  const collegeName = getCollegeName(row);
  if (!collegeName) continue;

  const key = yearIdentityKey(row, collegeName);
  admissionsByYearIdentity.set(key, [...(admissionsByYearIdentity.get(key) ?? []), row]);

  if (row.year === LEGACY_REFERENCE_YEAR && row.group_code === "000") {
    const legacyKey = `${row.subject_track}|${normalizeCollegeName(collegeName)}`;
    legacyAdmissionsBySubjectCollege.set(legacyKey, [
      ...(legacyAdmissionsBySubjectCollege.get(legacyKey) ?? []),
      row,
    ]);
  }
}

for (const row of plans) {
  const collegeName = getCollegeName(row);
  if (!collegeName) continue;

  const key = yearIdentityKey(row, collegeName);
  planCountsByYearIdentity.set(key, (planCountsByYearIdentity.get(key) ?? 0) + Number(row.plan_count));
}

const backtestItems: BacktestItem[] = [];

for (const rows of admissionsByYearIdentity.values()) {
  const actualRow = chooseAdmissionLine(rows);
  if (!actualRow || actualRow.year !== TARGET_YEAR) continue;

  const collegeName = getCollegeName(actualRow);
  if (!collegeName) continue;

  const targetIdentity = identityKey(actualRow, collegeName);
  const previousLine = chooseAdmissionLine(
    admissionsByYearIdentity.get(`${TRAINING_GROUP_YEAR}|${targetIdentity}`) ?? [],
  );

  if (!previousLine) continue;

  const legacyLine = chooseAdmissionLine(
    legacyAdmissionsBySubjectCollege.get(`${actualRow.subject_track}|${normalizeCollegeName(collegeName)}`) ?? [],
  );
  const ranks: HistoricalRank[] = [
    {
      year: Number(TRAINING_GROUP_YEAR),
      minRank: Number(previousLine.min_rank),
      scope: "group",
    },
  ];

  if (legacyLine) {
    ranks.push({
      year: Number(LEGACY_REFERENCE_YEAR),
      minRank: Number(legacyLine.min_rank),
      scope: "legacy_college",
    });
  }

  const currentPlanCount = planCountsByYearIdentity.get(`${TARGET_YEAR}|${targetIdentity}`) ?? 0;
  const previousPlanCount = planCountsByYearIdentity.get(`${TRAINING_GROUP_YEAR}|${targetIdentity}`) ?? 0;
  const planChangeRatio =
    currentPlanCount > 0 && previousPlanCount > 0 ? (currentPlanCount - previousPlanCount) / previousPlanCount : 0;
  const model = calculateReferenceRank({
    ranks,
    planChangeRatio,
  });

  if (!model.referenceRank) continue;

  const actualRank = Number(actualRow.min_rank);
  const predictedRank = model.referenceRank;
  const rankGap = actualRank - predictedRank;

  backtestItems.push({
    subjectTrack: actualRow.subject_track,
    collegeName,
    collegeCode: actualRow.college_code,
    groupCode: actualRow.group_code,
    predictedRank,
    actualRank,
    absErrorRatio: Math.abs(predictedRank - actualRank) / actualRank,
    tierAtActualLine: getTierByRankGap(rankGap, predictedRank),
    hasLegacyReference: Boolean(legacyLine),
  });
}

const physicsSummary = summarize(backtestItems.filter((item) => item.subjectTrack === "physics"));
const historySummary = summarize(backtestItems.filter((item) => item.subjectTrack === "history"));
const allSummary = summarize(backtestItems);

console.table(
  [
    ["physics", physicsSummary],
    ["history", historySummary],
    ["all", allSummary],
  ].map(([label, summary]) => {
    const row = summary as BacktestSummary;

    return {
      label,
      count: row.count,
      withLegacyReference: row.withLegacyReference,
      medianAbsError: formatPercent(row.medianAbsErrorRatio),
      p75AbsError: formatPercent(row.p75AbsErrorRatio),
      p90AbsError: formatPercent(row.p90AbsErrorRatio),
      within12: formatPercent(row.within12Ratio),
      within20: formatPercent(row.within20Ratio),
      within30: formatPercent(row.within30Ratio),
      recommendedEnvelope: formatPercent(row.recommendedEnvelopeRatio),
      tierCounts: JSON.stringify(row.tierCounts),
    };
  }),
);

assert.ok(allSummary.count >= 220, "backtest should cover enough same-name 2025/2024 college groups");
assert.ok(physicsSummary.count >= 130, "physics backtest coverage should remain representative");
assert.ok(historySummary.count >= 85, "history backtest coverage should remain representative");
assert.ok(allSummary.medianAbsErrorRatio <= 0.1, "median absolute rank error should stay within 10%");
assert.ok(allSummary.p75AbsErrorRatio <= 0.16, "p75 absolute rank error should stay within 16%");
assert.ok(allSummary.within20Ratio >= 0.8, "at least 80% of comparable groups should be within 20%");
assert.ok(allSummary.within30Ratio >= 0.88, "at least 88% of comparable groups should be within 30%");
assert.ok(
  allSummary.recommendedEnvelopeRatio >= 0.74,
  "most actual admission lines should fall into reach/match/safe rather than extreme buckets",
);

console.log("Week 10 backtest OK");
