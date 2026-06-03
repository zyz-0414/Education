import assert from "node:assert/strict";

import {
  buildVolunteerRiskReport,
  HIGH_TUITION_THRESHOLD,
  type VolunteerRiskReportItem,
  type VolunteerRiskReportTier,
} from "../src/lib/volunteer-risk-report";

function makeItem(
  index: number,
  tier: VolunteerRiskReportTier = "match",
  overrides: Partial<VolunteerRiskReportItem> = {},
): VolunteerRiskReportItem {
  return {
    planKey: `2025-physics-${String(index).padStart(4, "0")}-001`,
    collegeName: `测试大学${index}`,
    collegeCode: String(index).padStart(4, "0"),
    groupCode: "001",
    tier,
    tierLabel: tier,
    referenceRank: 50000 + index * 100,
    rankGapRatio: tier === "high_risk" ? 0.2 : tier === "reach" ? 0.05 : -0.1,
    lowConfidence: false,
    confidenceReasons: [],
    preferencePenalties: [],
    majorPlans: [
      {
        majorName: "计算机科学与技术",
        tuition: 6000,
        note: null,
      },
    ],
    eligiblePlanCount: 20,
    ...overrides,
  };
}

const emptyReport = buildVolunteerRiskReport([], { generatedAt: "2026-06-02T00:00:00.000Z" });
assert.equal(emptyReport.status, "empty");
assert.equal(emptyReport.issues[0]?.code, "EMPTY_PLAN");

const riskyReport = buildVolunteerRiskReport(
  [
    makeItem(1, "high_risk"),
    ...Array.from({ length: 13 }, (_, index) => makeItem(index + 2, "reach")),
    ...Array.from({ length: 4 }, (_, index) => makeItem(index + 30, "safe")),
    makeItem(80, "match", {
      preferencePenalties: ["包含排斥专业方向"],
      majorPlans: [
        {
          majorName: "土木工程",
          tuition: 5200,
          note: null,
        },
      ],
    }),
    makeItem(81, "match", {
      majorPlans: [
        {
          majorName: "电子信息工程(中外合作办学)",
          tuition: HIGH_TUITION_THRESHOLD + 10000,
          note: "高学费专业，中外合作办学",
        },
      ],
    }),
    makeItem(82, "match", {
      lowConfidence: true,
      confidenceReasons: ["近三年历史位次不完整"],
    }),
  ],
  {
    generatedAt: "2026-06-02T00:00:00.000Z",
    preferences: {
      tuitionLimit: 12000,
      rejectedMajorCategories: ["土木"],
    },
  },
);

assert.equal(riskyReport.status, "high_risk");
assert.ok(riskyReport.issues.some((issue) => issue.code === "SLIDING_RISK" && issue.severity === "danger"));
assert.ok(riskyReport.issues.some((issue) => issue.code === "SAFETY_NOT_ENOUGH"));
assert.ok(riskyReport.issues.some((issue) => issue.code === "REJECTED_MAJOR"));
assert.ok(riskyReport.issues.some((issue) => issue.code === "HIGH_TUITION"));
assert.ok(riskyReport.issues.some((issue) => issue.code === "LOW_CONFIDENCE"));
assert.equal(riskyReport.metrics.safetyCount, 4);
assert.equal(riskyReport.metrics.highTuitionGroupCount, 1);
assert.equal(riskyReport.metrics.rejectedMajorGroupCount, 1);
assert.equal(riskyReport.metrics.lowConfidenceCount, 1);

const slidingRiskIssue = riskyReport.issues.find((issue) => issue.code === "SLIDING_RISK");
assert.equal(slidingRiskIssue?.evidence.length, 14);

const balancedReport = buildVolunteerRiskReport(
  [
    ...Array.from({ length: 10 }, (_, index) => makeItem(index, "reach")),
    ...Array.from({ length: 22 }, (_, index) => makeItem(index + 20, "match")),
    ...Array.from({ length: 10 }, (_, index) => makeItem(index + 50, "safe")),
    ...Array.from({ length: 3 }, (_, index) => makeItem(index + 70, "very_safe")),
  ],
  { generatedAt: "2026-06-02T00:00:00.000Z" },
);

assert.equal(balancedReport.status, "ready");
assert.equal(balancedReport.metrics.total, 45);
assert.equal(balancedReport.metrics.safetyCount, 13);
assert.equal(balancedReport.issues.length, 0);

console.log("Week 8 risk report tests OK");
