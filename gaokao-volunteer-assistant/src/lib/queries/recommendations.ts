import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { calculatePreferenceScore } from "@/lib/recommend/preference-score";
import { calculateReferenceRank } from "@/lib/recommend/rank-model";
import { getTierByRankGap, tierLabels, type RecommendationTier } from "@/lib/recommend/tier";
import type { CandidateProfile } from "@/lib/validators/profile";
import { getCandidateCollegeGroups } from "./candidate-groups";

const ALGORITHM_VERSION = "week5-rank-v1";
const DEFAULT_DATA_VERSION = "dev-anhui-2026-prep";
const RECOMMENDATION_POOL_LIMIT = 5000;
const DEFAULT_RECOMMENDATION_LIMIT = 45;
const MAX_COLLEGE_REPEAT_IN_PLAN = 3;

type CandidateResult = Awaited<ReturnType<typeof getCandidateCollegeGroups>>;
type CandidateItem = CandidateResult["items"][number];
type AdmissionHistoryRow = Prisma.AdmissionResultGetPayload<{
  include: {
    source: true;
  };
}>;
type AdmissionHistory = AdmissionHistoryRow & {
  collegeNameSnapshot: string | null;
};

export type RecommendationQueryOptions = {
  requirePlan?: boolean;
  limit?: number;
  offset?: number;
  includeHighRisk?: boolean;
  includeVerySafe?: boolean;
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

type PreviousPlan = Prisma.MajorPlanGetPayload<{
  select: {
    year: true;
    collegeCode: true;
    groupCode: true;
    planCount: true;
  };
}> & {
  collegeNameSnapshot: string | null;
};

function normalizeCollegeName(value: string | null | undefined) {
  return (value ?? "").trim();
}

function codeGroupKey(row: { collegeCode: string; groupCode: string }) {
  return `${row.collegeCode}|${row.groupCode}`;
}

function yearCodeGroupKey(row: { year: number; collegeCode: string; groupCode: string }) {
  return `${row.year}|${codeGroupKey(row)}`;
}

function rowKey(row: { collegeCode: string; groupCode: string }, collegeName: string | null | undefined) {
  return `${codeGroupKey(row)}|${normalizeCollegeName(collegeName)}`;
}

function itemKey(item: CandidateItem) {
  return rowKey(item.key, item.college.collegeName);
}

function admissionHistoryKey(row: AdmissionHistory) {
  return rowKey(row, row.collegeNameSnapshot);
}

function previousPlanKey(row: PreviousPlan) {
  return rowKey(row, row.collegeNameSnapshot);
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

  return 100 - Math.min(Math.abs(rankGapRatio) * 180, 100);
}

const tierSortPriority: Record<RecommendationTier, number> = {
  high_risk: 0,
  reach: 1,
  match: 2,
  safe: 3,
  very_safe: 4,
};

function compareRecommendationRankFit(
  a: ReturnType<typeof buildRecommendation>,
  b: ReturnType<typeof buildRecommendation>,
) {
  const aTier = a.recommendation.tier;
  const bTier = b.recommendation.tier;

  if (aTier && bTier && tierSortPriority[aTier] !== tierSortPriority[bTier]) {
    return tierSortPriority[aTier] - tierSortPriority[bTier];
  }

  if (b.recommendation.rankFitScore !== a.recommendation.rankFitScore) {
    return b.recommendation.rankFitScore - a.recommendation.rankFitScore;
  }

  const aGap = a.recommendation.rankGapRatio;
  const bGap = b.recommendation.rankGapRatio;

  if (aGap !== null && bGap !== null) {
    const rankGapDistance = Math.abs(aGap) - Math.abs(bGap);
    if (rankGapDistance !== 0) {
      return rankGapDistance;
    }
  }

  if (aGap !== null) return -1;
  if (bGap !== null) return 1;

  if (b.recommendation.recommendationScore !== a.recommendation.recommendationScore) {
    return b.recommendation.recommendationScore - a.recommendation.recommendationScore;
  }

  return a.key.collegeCode.localeCompare(b.key.collegeCode) || a.key.groupCode.localeCompare(b.key.groupCode);
}

function compareRecommendationDisplayOrder(
  a: ReturnType<typeof buildRecommendation>,
  b: ReturnType<typeof buildRecommendation>,
) {
  const aTier = a.recommendation.tier;
  const bTier = b.recommendation.tier;

  if (aTier && bTier && tierSortPriority[aTier] !== tierSortPriority[bTier]) {
    return tierSortPriority[aTier] - tierSortPriority[bTier];
  }

  const aReferenceRank = a.recommendation.referenceRank;
  const bReferenceRank = b.recommendation.referenceRank;

  if (aReferenceRank !== null && bReferenceRank !== null && aReferenceRank !== bReferenceRank) {
    return aReferenceRank - bReferenceRank;
  }

  if (aReferenceRank !== null) return -1;
  if (bReferenceRank !== null) return 1;

  if (b.recommendation.recommendationScore !== a.recommendation.recommendationScore) {
    return b.recommendation.recommendationScore - a.recommendation.recommendationScore;
  }

  return a.key.collegeCode.localeCompare(b.key.collegeCode) || a.key.groupCode.localeCompare(b.key.groupCode);
}

type RecommendationItemWithScore = ReturnType<typeof buildRecommendation>;

type RecommendationMix = Record<RecommendationTier, number>;

type RecommendationSelectionState = {
  selectedKeys: Set<string>;
  collegeCounts: Map<string, number>;
};

const balancedMixByPreference: Record<CandidateProfile["riskPreference"], RecommendationMix> = {
  aggressive: {
    high_risk: 6,
    reach: 12,
    match: 16,
    safe: 9,
    very_safe: 2,
  },
  balanced: {
    high_risk: 4,
    reach: 10,
    match: 18,
    safe: 10,
    very_safe: 3,
  },
  conservative: {
    high_risk: 2,
    reach: 6,
    match: 16,
    safe: 17,
    very_safe: 4,
  },
};

function getSelectionKey(item: RecommendationItemWithScore) {
  return `${item.key.year}|${item.key.subjectTrack}|${item.key.collegeCode}|${item.key.groupCode}`;
}

function getCollegeSelectionKey(item: RecommendationItemWithScore) {
  return normalizeCollegeName(item.college.collegeName) || item.key.collegeCode;
}

function getRecommendationMix(
  riskPreference: CandidateProfile["riskPreference"],
  includeHighRisk: boolean,
  includeVerySafe: boolean,
  limit: number,
) {
  const mix = { ...balancedMixByPreference[riskPreference] };

  if (!includeHighRisk) {
    mix.reach += mix.high_risk;
    mix.high_risk = 0;
  }

  if (!includeVerySafe) {
    mix.safe += mix.very_safe;
    mix.very_safe = 0;
  }

  if (limit === DEFAULT_RECOMMENDATION_LIMIT) {
    return mix;
  }

  const entries = Object.entries(mix) as Array<[RecommendationTier, number]>;
  const scaled = Object.fromEntries(entries.map(([tier, count]) => [tier, Math.floor((count * limit) / DEFAULT_RECOMMENDATION_LIMIT)])) as RecommendationMix;
  let remaining = limit - Object.values(scaled).reduce((sum, count) => sum + count, 0);

  for (const tier of ["match", "safe", "reach", "high_risk", "very_safe"] satisfies RecommendationTier[]) {
    if (remaining <= 0) break;
    if (mix[tier] === 0) continue;
    scaled[tier] += 1;
    remaining -= 1;
  }

  return scaled;
}

function getSpreadOrder(items: RecommendationItemWithScore[], count: number) {
  if (count <= 1 || items.length <= count) {
    return items;
  }

  const used = new Set<number>();
  const spread: RecommendationItemWithScore[] = [];

  for (let index = 0; index < count; index += 1) {
    const itemIndex = Math.round((index / (count - 1)) * (items.length - 1));
    if (used.has(itemIndex)) continue;
    used.add(itemIndex);
    spread.push(items[itemIndex]);
  }

  return [...spread, ...items.filter((_item, index) => !used.has(index))];
}

function addRecommendation(
  item: RecommendationItemWithScore,
  state: RecommendationSelectionState,
  selected: RecommendationItemWithScore[],
  respectCollegeLimit: boolean,
) {
  const key = getSelectionKey(item);
  if (state.selectedKeys.has(key)) {
    return false;
  }

  const collegeKey = getCollegeSelectionKey(item);
  const collegeCount = state.collegeCounts.get(collegeKey) ?? 0;
  if (respectCollegeLimit && collegeCount >= MAX_COLLEGE_REPEAT_IN_PLAN) {
    return false;
  }

  selected.push(item);
  state.selectedKeys.add(key);
  state.collegeCounts.set(collegeKey, collegeCount + 1);
  return true;
}

function takeFromPool(
  pool: RecommendationItemWithScore[],
  count: number,
  state: RecommendationSelectionState,
  selected: RecommendationItemWithScore[],
  options: { spread?: boolean } = {},
) {
  if (count <= 0 || pool.length === 0) {
    return;
  }

  const beforeCount = selected.length;
  const ordered = options.spread ? getSpreadOrder(pool, count) : pool;

  for (const item of ordered) {
    if (selected.length - beforeCount >= count) break;
    addRecommendation(item, state, selected, true);
  }

  for (const item of ordered) {
    if (selected.length - beforeCount >= count) break;
    addRecommendation(item, state, selected, false);
  }
}

function selectBalancedRecommendations(
  items: RecommendationItemWithScore[],
  profile: CandidateProfile,
  options: { limit: number; includeHighRisk: boolean; includeVerySafe: boolean },
) {
  const mix = getRecommendationMix(
    profile.riskPreference,
    options.includeHighRisk,
    options.includeVerySafe,
    options.limit,
  );
  const pools = {
    reach: items.filter((item) => item.recommendation.tier === "reach"),
    match: items.filter((item) => item.recommendation.tier === "match"),
    safe: items.filter((item) => item.recommendation.tier === "safe"),
    very_safe: items.filter((item) => item.recommendation.tier === "very_safe"),
    high_risk: items.filter((item) => item.recommendation.tier === "high_risk"),
  } satisfies Record<RecommendationTier, RecommendationItemWithScore[]>;
  const selected: RecommendationItemWithScore[] = [];
  const state: RecommendationSelectionState = {
    selectedKeys: new Set(),
    collegeCounts: new Map(),
  };

  for (const tier of ["high_risk", "reach", "match", "safe", "very_safe"] satisfies RecommendationTier[]) {
    takeFromPool(pools[tier], mix[tier], state, selected, { spread: tier === "safe" });
  }

  const fillOrder: RecommendationTier[] = profile.riskPreference === "conservative"
    ? ["safe", "match", "very_safe", "reach", "high_risk"]
    : profile.riskPreference === "aggressive"
      ? ["reach", "high_risk", "match", "safe", "very_safe"]
      : ["match", "safe", "reach", "very_safe", "high_risk"];

  for (const tier of fillOrder) {
    if (selected.length >= options.limit) break;
    if (tier === "high_risk" && !options.includeHighRisk) continue;
    if (tier === "very_safe" && !options.includeVerySafe) continue;
    takeFromPool(pools[tier], options.limit - selected.length, state, selected, { spread: tier === "safe" });
  }

  return selected.slice(0, options.limit).sort(compareRecommendationDisplayOrder);
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
  const tier =
    rankModel.referenceRank === null || rankGap === null ? null : getTierByRankGap(rankGap, rankModel.referenceRank);
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
  const includeHighRisk = options.includeHighRisk ?? false;
  const includeVerySafe = options.includeVerySafe ?? true;
  const requirePlan = options.requirePlan ?? true;
  const candidateResult = await getCandidateCollegeGroups(profile, {
    requirePlan,
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
        includeVerySafe,
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
        codeGroupKey(item.key),
        {
          collegeCode: item.key.collegeCode,
          groupCode: item.key.groupCode,
        },
      ]),
    ).values(),
  );
  const candidateKeySet = new Set(uniqueKeys.map(codeGroupKey));
  const referenceYears = getReferenceYears(profile.targetYear);
  const snapshotYears = Array.from(new Set([...referenceYears, profile.targetYear - 1]));
  const [allHistoryRows, allPreviousPlanRows, groupSnapshots] = await prisma.$transaction([
    prisma.admissionResult.findMany({
      where: {
        year: { in: referenceYears },
        provinceCode: profile.provinceCode,
        batchCode: profile.batchCode,
        subjectTrack: profile.firstChoiceSubject,
      },
      orderBy: [{ year: "desc" }, { minRank: "desc" }],
      include: {
        source: true,
      },
    }),
    prisma.majorPlan.findMany({
      where: {
        year: profile.targetYear - 1,
        provinceCode: profile.provinceCode,
        batchCode: profile.batchCode,
        subjectTrack: profile.firstChoiceSubject,
      },
      select: {
        year: true,
        collegeCode: true,
        groupCode: true,
        planCount: true,
      },
    }),
    prisma.collegeGroup.findMany({
      where: {
        year: { in: snapshotYears },
        provinceCode: profile.provinceCode,
        batchCode: profile.batchCode,
        subjectTrack: profile.firstChoiceSubject,
      },
      select: {
        year: true,
        collegeCode: true,
        groupCode: true,
        collegeNameSnapshot: true,
      },
    }),
  ]);
  const snapshotByYearGroup = new Map(
    groupSnapshots.map((row) => [yearCodeGroupKey(row), row.collegeNameSnapshot]),
  );
  const historyRows: AdmissionHistory[] = allHistoryRows
    .filter((row) => candidateKeySet.has(codeGroupKey(row)))
    .map((row) => ({
      ...row,
      collegeNameSnapshot: snapshotByYearGroup.get(yearCodeGroupKey(row)) ?? null,
    }));
  const previousPlans: PreviousPlan[] = allPreviousPlanRows
    .filter((row) => candidateKeySet.has(codeGroupKey(row)))
    .map((row) => ({
      ...row,
      collegeNameSnapshot: snapshotByYearGroup.get(yearCodeGroupKey(row)) ?? null,
    }));
  const historiesByGroup = new Map<string, AdmissionHistory[]>();
  const previousPlanCounts = new Map<string, number>();

  for (const history of historyRows) {
    const key = admissionHistoryKey(history);
    historiesByGroup.set(key, [...(historiesByGroup.get(key) ?? []), history]);
  }

  for (const plan of previousPlans) {
    const key = previousPlanKey(plan);
    previousPlanCounts.set(key, (previousPlanCounts.get(key) ?? 0) + plan.planCount);
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
    .filter((item) => item.recommendation.tier !== null)
    .filter((item) => includeHighRisk || item.recommendation.tier !== "high_risk")
    .sort(compareRecommendationRankFit);
  const balancedRecommendations = selectBalancedRecommendations(recommendations, profile, {
    limit: Math.min(offset + limit, 100),
    includeHighRisk,
    includeVerySafe,
  });

  for (const item of balancedRecommendations) {
    tierCounts[item.recommendation.tier ?? "unranked"] += 1;
  }

  const paged = balancedRecommendations.slice(offset, offset + limit);

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
      recommendableCount: balancedRecommendations.length,
      lowConfidenceCount: balancedRecommendations.filter((item) => item.recommendation.lowConfidence).length,
      tierCounts,
      includeHighRisk,
      includeVerySafe,
    },
    total: balancedRecommendations.length,
    limit,
    offset,
    items: paged,
  };
}
