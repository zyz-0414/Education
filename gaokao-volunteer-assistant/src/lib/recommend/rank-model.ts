type HistoricalRank = {
  year: number;
  minRank: number;
};

type ReferenceRankInput = {
  ranks: HistoricalRank[];
  planChangeRatio?: number;
};

export type ReferenceRankConfidence = "medium" | "low";

export function calculateReferenceRank({ ranks, planChangeRatio = 0 }: ReferenceRankInput) {
  const usableRanks = ranks
    .filter((item) => Number.isFinite(item.minRank) && item.minRank > 0)
    .sort((a, b) => b.year - a.year);
  const reasons: string[] = [];

  if (usableRanks.length === 0) {
    return {
      referenceRank: null,
      confidence: "low" as ReferenceRankConfidence,
      reason: "缺少历史最低位次数据",
      reasons: ["缺少历史最低位次数据"],
      historicalRanks: [],
      planChangeRatio: 0,
      volatilityRatio: null,
    };
  }

  const weights = usableRanks.length === 1 ? [1] : [0.6, 0.4, 0.25, 0.15, 0.1];
  const totalWeight = usableRanks.reduce((sum, _rank, index) => sum + (weights[index] ?? 0.1), 0);
  const weightedRank =
    usableRanks.reduce((sum, rank, index) => sum + rank.minRank * (weights[index] ?? 0.1), 0) /
    totalWeight;

  const boundedPlanChangeRatio = Math.max(Math.min(planChangeRatio, 0.3), -0.3);
  const planAdjustment = weightedRank * boundedPlanChangeRatio * 0.2;
  if (boundedPlanChangeRatio !== 0) {
    reasons.push(`招生计划变化修正 ${(boundedPlanChangeRatio * 100).toFixed(1)}%`);
  }

  const latestRank = usableRanks[0];
  const previousRank = usableRanks[1] ?? null;
  const volatilityRatio = previousRank
    ? Math.abs(latestRank.minRank - previousRank.minRank) / previousRank.minRank
    : null;
  const volatilityAdjustment =
    volatilityRatio && volatilityRatio > 0.12 ? -weightedRank * Math.min(volatilityRatio * 0.1, 0.05) : 0;

  if (volatilityRatio && volatilityRatio > 0.12) {
    reasons.push(`近两年位次波动 ${(volatilityRatio * 100).toFixed(1)}%，已做保守修正`);
  }

  const referenceRank = Math.round(weightedRank + planAdjustment + volatilityAdjustment);
  const confidence: ReferenceRankConfidence =
    usableRanks.length >= 2 && (!volatilityRatio || volatilityRatio <= 0.2) ? "medium" : "low";
  const baseReason = usableRanks.length >= 2 ? "使用改革后同口径历史位次加权" : "仅有单年数据，需标低置信度";

  return {
    referenceRank,
    confidence,
    reason: baseReason,
    reasons: [baseReason, ...reasons],
    historicalRanks: usableRanks,
    planChangeRatio: boundedPlanChangeRatio,
    volatilityRatio,
  };
}
