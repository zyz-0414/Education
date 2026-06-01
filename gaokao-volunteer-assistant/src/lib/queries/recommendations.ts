import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { calculatePreferenceScore } from "@/lib/recommend/preference-score";
import { calculateReferenceRank } from "@/lib/recommend/rank-model";
import { getTierByRankGapRatio, tierLabels, type RecommendationTier } from "@/lib/recommend/tier";
import type { CandidateProfile } from "@/lib/validators/profile";
import { getCandidateCollegeGroups } from "./candidate-groups";

const ALGORITHM_VERSION = "week5-rank-v1";
const DEFAULT_DATA_VERSION = "dev-anhui-2026-prep";
const RECOMMENDATION_POOL_LIMIT = 500;

type CandidateResult = Awaited<ReturnType<typeof getCandidateCollegeGroups>>;
type CandidateItem = CandidateResult["items"][number];
type AdmissionHistory = Prisma.AdmissionResultGetPayload<{
  include: { source: true };
}>;

export type RecommendationQueryOptions = {
  requirePlan?: boolean;
  limit?: number;
  offset?: number;
  includeHighRisk?: boolean;
};

type TierBucket = RecommendationTier | "unranked";

const emptyTierCounts = (): Record<TierBucket, number> => ({
  reach: 0,
  match: 0,
  safe: 0,
  very_safe: 0,
  high_risk: 0,
  unranked: 0,
});

function itemKey(item: CandidateItem) {
  return `${item.key.collegeCode}|${item.key.groupCode}`;
}

function rowKey(row: { collegeCode: string; groupCode: string }) {
  return `${row.collegeCode}|${row.groupCode}`;
}

function getReferenceYears(targetYear: number) {
  if (targetYear >= 2026) {
    return [targetYear - 1, targetYear - 2, targetYear - 3].filter((year) => year >= 2024);
  }

  return [targetYear, targetYear - 1, targetYear - 2].filter((year) => year >= 2024);
}

function chooseGroupAdmissionByYear(rows: AdmissionHistory[]) {
  const byYear = new Map<number, AdmissionHistory>();

  for (const row of rows) {
    if (!row.minRank) continue;

    const existing = byYear.get(row.year);
    if (!existing) {
      byYear.set(row.year, row);
      continue;
    }

    if (existing.majorCode && !row.majorCode) {
      byYear.set(row.year, row);
      continue;
    }

    if (existing.majorCode && row.majorCode && row.minRank > (existing.minRank ?? 0)) {
      byYear.set(row.year, row);
    }
  }

  return Array.from(byYear.values()).sort((a, b) => b.year - a.year);
}

function calculatePlanChangeRatio(currentPlanCount: number, previousPlanCount: number | undefined) {
  if (!currentPlanCount || !previousPlanCount) {
    return {
      value: 0,
      reason: "缺少上一年计划，计划变化修正未启用",
    };
  }

  return {
    value: (currentPlanCount - previousPlanCount) / previousPlanCount,
    reason: null,
  };
}

function getSourceConfidenceReasons(item: CandidateItem, histories: AdmissionHistory[]) {
  const reasons = new Set<string>();
  const statuses = new Set<string>();

  statuses.add(item.source.reviewStatus);

  for (const plan of item.majorPlans) {
    statuses.add(plan.source.reviewStatus);
  }

  for (const history of histories) {
    statuses.add(history.source.reviewStatus);
  }

  if (statuses.has("ocr_sample_needs_review")) {
    reasons.add("历史投档结果来自 OCR 样例，需人工复核");
  }

  if (statuses.has("sample_collected")) {
    reasons.add("招生计划为开发样例，需替换正式计划");
  }

  if (statuses.has("pending") || statuses.has("planned")) {
    reasons.add("存在未完成复核的数据源");
  }

  return Array.from(reasons);
}

function describeRankGap(rankGapRatio: number | null) {
  if (rankGapRatio === null) {
    return "缺少可计算的位次差";
  }

  const percent = Math.abs(rankGapRatio * 100).toFixed(1);
  return rankGapRatio >= 0 ? `考生位次比参考位次靠后 ${percent}%` : `考生位次比参考位次靠前 ${percent}%`;
}

function calculateRankFitScore(rankGapRatio: number | null) {
  if (rankGapRatio === null) {
    return 0;
  }

  return 100 - Math.min(Math.abs(rankGapRatio) * 180, 45);
}

function buildRecommendation(
  profile: CandidateProfile,
  item: CandidateItem,
  histories: AdmissionHistory[],
  previousPlanCount: number | undefined,
) {
  const historicalAdmissions = chooseGroupAdmissionByYear(histories);
  const planChange = calculatePlanChangeRatio(item.eligibility.eligiblePlanCount, previousPlanCount);
  const rankModel = calculateReferenceRank({
    ranks: historicalAdmissions.map((history) => ({
      year: history.year,
      minRank: history.minRank ?? 0,
    })),
    planChangeRatio: planChange.value,
  });
  const rankGap = rankModel.referenceRank === null ? null : profile.rank - rankModel.referenceRank;
  const rankGapRatio =
    rankModel.referenceRank === null || rankGap === null ? null : rankGap / rankModel.referenceRank;
  const tier = rankGapRatio === null ? null : getTierByRankGapRatio(rankGapRatio);
  const preference = calculatePreferenceScore(profile, {
    tier,
    city: item.college.city,
    province: item.college.province,
    plans: item.majorPlans,
    hasEligiblePlan: item.eligibility.hasEligibleMajorPlan,
  });
  const confidenceReasons = new Set<string>();

  if (rankModel.historicalRanks.length < 2) {
    confidenceReasons.add("历史投档位次不足两年");
  }

  if (rankModel.referenceRank === null) {
    confidenceReasons.add("缺少可计算参考位次");
  }

  if (rankModel.volatilityRatio !== null && rankModel.volatilityRatio > 0.2) {
    confidenceReasons.add("近两年位次波动较大");
  }

  if (
    rankModel.confidence === "low" &&
    rankModel.historicalRanks.length >= 2 &&
    (rankModel.volatilityRatio === null || rankModel.volatilityRatio <= 0.2)
  ) {
    confidenceReasons.add("参考位次模型置信度较低");
  }

  if (!item.eligibility.hasEligibleMajorPlan) {
    confidenceReasons.add("缺少招生计划明细");
  }

  if (planChange.reason) {
    confidenceReasons.add(planChange.reason);
  }

  for (const reason of getSourceConfidenceReasons(item, histories)) {
    confidenceReasons.add(reason);
  }

  const lowConfidence = confidenceReasons.size > 0;
  const rankFitScore = calculateRankFitScore(rankGapRatio);
  const recommendationScore = Math.round(rankFitScore + preference.score - (lowConfidence ? 12 : 0));
  const tierLabel = tier ? tierLabels[tier] : "待确认";

  return {
    ...item,
    recommendation: {
      algorithmVersion: ALGORITHM_VERSION,
      tier,
      tierLabel,
      referenceRank: rankModel.referenceRank,
      rankGap,
      rankGapRatio,
      rankFitScore: Math.round(rankFitScore),
      preferenceScore: preference.score,
      recommendationScore,
      confidence: rankModel.confidence,
      lowConfidence,
      confidenceReasons: Array.from(confidenceReasons),
      modelReasons: rankModel.reasons,
      preferenceMatches: preference.matches,
      preferencePenalties: preference.penalties,
      historicalRanks: rankModel.historicalRanks,
      planChangeRatio: rankModel.planChangeRatio,
      volatilityRatio: rankModel.volatilityRatio,
      explanations: [
        `${tierLabel}档：${describeRankGap(rankGapRatio)}`,
        `参考位次 ${rankModel.referenceRank?.toLocaleString("zh-CN") ?? "待确认"}，考生位次 ${profile.rank.toLocaleString("zh-CN")}`,
        ...preference.matches.slice(0, 2),
      ],
    },
  };
}

export async function getCollegeGroupRecommendations(
  profile: CandidateProfile,
  options: RecommendationQueryOptions = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 45, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const includeHighRisk = options.includeHighRisk ?? true;
  const candidateResult = await getCandidateCollegeGroups(profile, {
    requirePlan: options.requirePlan,
    limit: RECOMMENDATION_POOL_LIMIT,
    offset: 0,
  });
  const tierCounts = emptyTierCounts();

  if (!candidateResult.scoreRankCheck.valid || candidateResult.items.length === 0) {
    return {
      profile,
      algorithm: {
        version: ALGORITHM_VERSION,
        dataVersion: process.env.NEXT_PUBLIC_DATA_VERSION ?? DEFAULT_DATA_VERSION,
        referenceYears: getReferenceYears(profile.targetYear),
      },
      scoreRankCheck: candidateResult.scoreRankCheck,
      filters: {
        ...candidateResult.filters,
        recommendableCount: 0,
        lowConfidenceCount: 0,
        tierCounts,
        includeHighRisk,
      },
      total: 0,
      limit,
      offset,
      items: [],
    };
  }

  const uniqueKeys = Array.from(
    new Map(
      candidateResult.items.map((item) => [
        itemKey(item),
        {
          collegeCode: item.key.collegeCode,
          groupCode: item.key.groupCode,
        },
      ]),
    ).values(),
  );
  const keyWhere = uniqueKeys.map((key) => ({
    collegeCode: key.collegeCode,
    groupCode: key.groupCode,
  }));
  const referenceYears = getReferenceYears(profile.targetYear);
  const [historyRows, previousPlans] = await prisma.$transaction([
    prisma.admissionResult.findMany({
      where: {
        year: { in: referenceYears },
        provinceCode: profile.provinceCode,
        batchCode: profile.batchCode,
        subjectTrack: profile.firstChoiceSubject,
        OR: keyWhere,
      },
      orderBy: [{ year: "desc" }, { minRank: "desc" }],
      include: { source: true },
    }),
    prisma.majorPlan.findMany({
      where: {
        year: profile.targetYear - 1,
        provinceCode: profile.provinceCode,
        batchCode: profile.batchCode,
        subjectTrack: profile.firstChoiceSubject,
        OR: keyWhere,
      },
      select: {
        collegeCode: true,
        groupCode: true,
        planCount: true,
      },
    }),
  ]);
  const historiesByGroup = new Map<string, AdmissionHistory[]>();
  const previousPlanCounts = new Map<string, number>();

  for (const history of historyRows) {
    const key = rowKey(history);
    historiesByGroup.set(key, [...(historiesByGroup.get(key) ?? []), history]);
  }

  for (const plan of previousPlans) {
    previousPlanCounts.set(rowKey(plan), (previousPlanCounts.get(rowKey(plan)) ?? 0) + plan.planCount);
  }

  const recommendations = candidateResult.items
    .map((item) =>
      buildRecommendation(
        profile,
        item,
        historiesByGroup.get(itemKey(item)) ?? [],
        previousPlanCounts.get(itemKey(item)),
      ),
    )
    .filter((item) => includeHighRisk || item.recommendation.tier !== "high_risk")
    .sort((a, b) => {
      if (b.recommendation.recommendationScore !== a.recommendation.recommendationScore) {
        return b.recommendation.recommendationScore - a.recommendation.recommendationScore;
      }

      return (a.recommendation.rankGapRatio ?? Number.POSITIVE_INFINITY) - (b.recommendation.rankGapRatio ?? Number.POSITIVE_INFINITY);
    });

  for (const item of recommendations) {
    tierCounts[item.recommendation.tier ?? "unranked"] += 1;
  }

  const paged = recommendations.slice(offset, offset + limit);

  return {
    profile,
    algorithm: {
      version: ALGORITHM_VERSION,
      dataVersion: process.env.NEXT_PUBLIC_DATA_VERSION ?? DEFAULT_DATA_VERSION,
      referenceYears,
    },
    scoreRankCheck: candidateResult.scoreRankCheck,
    filters: {
      ...candidateResult.filters,
      recommendableCount: recommendations.length,
      lowConfidenceCount: recommendations.filter((item) => item.recommendation.lowConfidence).length,
      tierCounts,
      includeHighRisk,
    },
    total: recommendations.length,
    limit,
    offset,
    items: paged,
  };
}
