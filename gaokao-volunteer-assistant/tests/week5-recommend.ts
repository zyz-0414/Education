import assert from "node:assert/strict";

import { calculatePreferenceScore } from "@/lib/recommend/preference-score";
import { calculateReferenceRank } from "@/lib/recommend/rank-model";
import { getTierByRankGap, getTierByRankGapRatio } from "@/lib/recommend/tier";
import { candidateProfileSchema } from "@/lib/validators/profile";

const profile = candidateProfileSchema.parse({
  targetYear: 2025,
  provinceCode: "AH",
  batchCode: "ordinary_undergraduate",
  firstChoiceSubject: "physics",
  secondChoiceSubjects: ["chemistry", "biology"],
  score: 550,
  rank: 70000,
  riskPreference: "balanced",
  preferredCities: ["西安"],
  preferredMajorCategories: ["财务"],
  rejectedMajorCategories: ["护理"],
  tuitionLimit: 30000,
});

const twoYearReference = calculateReferenceRank({
  ranks: [
    { year: 2025, minRank: 10000 },
    { year: 2024, minRank: 11000 },
  ],
});

assert.equal(twoYearReference.referenceRank, 10412);
assert.equal(twoYearReference.confidence, "medium");

const threeYearReference = calculateReferenceRank({
  ranks: [
    { year: 2025, minRank: 10000, scope: "group" },
    { year: 2024, minRank: 11000, scope: "group" },
    { year: 2023, minRank: 12000, scope: "legacy_college" },
  ],
});

assert.equal(threeYearReference.referenceRank, 10650);
assert.equal(threeYearReference.confidence, "medium");
assert.ok(threeYearReference.reasons.includes("含 2023 改革前文理科院校级位次参考"));

const oneYearReference = calculateReferenceRank({
  ranks: [{ year: 2025, minRank: 10000 }],
});

assert.equal(oneYearReference.referenceRank, 10000);
assert.equal(oneYearReference.confidence, "low");
assert.ok(oneYearReference.reasons.includes("仅有单年数据，需标低置信度"));

assert.equal(getTierByRankGapRatio(0.05), "reach");
assert.equal(getTierByRankGapRatio(-0.08), "match");
assert.equal(getTierByRankGapRatio(-0.2), "safe");
assert.equal(getTierByRankGapRatio(-0.31), "very_safe");
assert.equal(getTierByRankGapRatio(0.12), "reach");
assert.equal(getTierByRankGapRatio(0.121), "high_risk");
assert.equal(getTierByRankGap(1450 - 1216, 1216), "reach");
assert.equal(getTierByRankGap(1450 - 1000, 1000), "high_risk");
assert.equal(getTierByRankGap(7000 - 6000, 6000), "reach");
assert.equal(getTierByRankGap(7000 - 5900, 5900), "high_risk");
assert.equal(getTierByRankGap(1450 - 3070, 3070), "safe");
assert.equal(getTierByRankGap(1450 - 23648, 23648), "very_safe");

const matchedPreference = calculatePreferenceScore(profile, {
  tier: "match",
  city: "西安",
  province: "陕西",
  hasEligiblePlan: true,
  plans: [
    {
      majorName: "财务管理",
      tuition: 27000,
      note: null,
    },
  ],
});
const riskyPreference = calculatePreferenceScore(profile, {
  tier: "high_risk",
  city: "合肥",
  province: "安徽",
  hasEligiblePlan: false,
  plans: [
    {
      majorName: "护理学",
      tuition: 36000,
      note: null,
    },
  ],
});

assert.ok(matchedPreference.score > riskyPreference.score);
assert.ok(matchedPreference.matches.includes("城市偏好命中"));
assert.ok(riskyPreference.penalties.includes("包含排斥专业方向"));

console.log("Week 5 recommendation tests OK");
