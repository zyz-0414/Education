type HistoricalRank = {
  year: number;
  minRank: number;
};

type ReferenceRankInput = {
  ranks: HistoricalRank[];
  planChangeRatio?: number;
};

export function calculateReferenceRank({ ranks, planChangeRatio = 0 }: ReferenceRankInput) {
  const usableRanks = ranks
    .filter((item) => Number.isFinite(item.minRank) && item.minRank > 0)
    .sort((a, b) => b.year - a.year);

  if (usableRanks.length === 0) {
    return {
      referenceRank: null,
      confidence: "low" as const,
      reason: "缺少历史最低位次数据",
    };
  }

  const weights = usableRanks.length === 1 ? [1] : [0.6, 0.4, 0.25, 0.15, 0.1];
  const totalWeight = usableRanks.reduce((sum, _rank, index) => sum + (weights[index] ?? 0.1), 0);
  const weightedRank =
    usableRanks.reduce((sum, rank, index) => sum + rank.minRank * (weights[index] ?? 0.1), 0) /
    totalWeight;

  const boundedPlanChangeRatio = Math.max(Math.min(planChangeRatio, 0.3), -0.3);
  const planAdjustment = weightedRank * boundedPlanChangeRatio * 0.2;
  const referenceRank = Math.round(weightedRank + planAdjustment);

  return {
    referenceRank,
    confidence: usableRanks.length >= 2 ? ("medium" as const) : ("low" as const),
    reason: usableRanks.length >= 2 ? "使用改革后同口径历史位次加权" : "仅有单年数据，需标低置信度",
  };
}
