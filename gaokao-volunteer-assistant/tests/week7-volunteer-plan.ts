import assert from "node:assert/strict";

import {
  analyzeVolunteerPlan,
  canAddVolunteerPlanItem,
  moveVolunteerPlanItem,
  VOLUNTEER_PLAN_LIMIT,
  type VolunteerPlanReference,
} from "../src/lib/volunteer-plan";

function makeItem(index: number, tier: VolunteerPlanReference["tier"] = "match"): VolunteerPlanReference {
  return {
    planKey: `2025-physics-${String(index).padStart(4, "0")}-001`,
    tier,
  };
}

const emptyAnalysis = analyzeVolunteerPlan([]);
assert.equal(emptyAnalysis.total, 0);
assert.equal(emptyAnalysis.remaining, VOLUNTEER_PLAN_LIMIT);
assert.equal(emptyAnalysis.issues[0]?.code, "EMPTY");

const oneItem = [makeItem(1, "safe")];
assert.deepEqual(canAddVolunteerPlanItem(oneItem, makeItem(1, "safe")), {
  ok: false,
  reason: "该院校专业组已在志愿表中",
});

const fullPlan = Array.from({ length: VOLUNTEER_PLAN_LIMIT }, (_, index) => makeItem(index));
assert.deepEqual(canAddVolunteerPlanItem(fullPlan, makeItem(99)), {
  ok: false,
  reason: `志愿表最多 ${VOLUNTEER_PLAN_LIMIT} 个院校专业组`,
});

const ordered = [makeItem(1), makeItem(2), makeItem(3)];
assert.deepEqual(
  moveVolunteerPlanItem(ordered, 2, "up").map((item) => item.planKey),
  [ordered[0].planKey, ordered[2].planKey, ordered[1].planKey],
);
assert.deepEqual(moveVolunteerPlanItem(ordered, 0, "up"), ordered);

const riskyPlan = [
  ...Array.from({ length: 13 }, (_, index) => makeItem(index, "reach")),
  ...Array.from({ length: 4 }, (_, index) => makeItem(index + 20, "safe")),
  makeItem(40, "high_risk"),
];
const riskyAnalysis = analyzeVolunteerPlan(riskyPlan);
assert.equal(riskyAnalysis.tierCounts.reach, 13);
assert.equal(riskyAnalysis.tierCounts.high_risk, 1);
assert.equal(riskyAnalysis.hasEnoughSafety, false);
assert.ok(riskyAnalysis.issues.some((issue) => issue.code === "SAFETY_NOT_ENOUGH"));
assert.ok(riskyAnalysis.issues.some((issue) => issue.code === "REACH_TOO_MANY"));
assert.ok(riskyAnalysis.issues.some((issue) => issue.code === "HIGH_RISK_INCLUDED"));

const balancedPlan = [
  ...Array.from({ length: 10 }, (_, index) => makeItem(index, "reach")),
  ...Array.from({ length: 22 }, (_, index) => makeItem(index + 20, "match")),
  ...Array.from({ length: 10 }, (_, index) => makeItem(index + 50, "safe")),
  ...Array.from({ length: 3 }, (_, index) => makeItem(index + 70, "very_safe")),
];
const balancedAnalysis = analyzeVolunteerPlan(balancedPlan);
assert.equal(balancedAnalysis.total, VOLUNTEER_PLAN_LIMIT);
assert.equal(balancedAnalysis.remaining, 0);
assert.equal(balancedAnalysis.hasEnoughSafety, true);
assert.equal(balancedAnalysis.issues.some((issue) => issue.severity === "danger"), false);

console.log("Week 7 volunteer plan tests OK");
