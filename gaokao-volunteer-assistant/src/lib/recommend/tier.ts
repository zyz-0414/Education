export type RecommendationTier = "reach" | "match" | "safe" | "very_safe" | "high_risk";

const MIN_REACH_ABSOLUTE_GAP = 350;
const MIN_SAFE_ABSOLUTE_ADVANTAGE = 10000;
const REACH_GAP_RATIO_LIMIT = 0.12;

function getReachAbsoluteGapLimit(candidateRank: number) {
  if (candidateRank <= 2000) return MIN_REACH_ABSOLUTE_GAP;
  if (candidateRank <= 5000) return 600;
  return 1000;
}

export function getTierByRankGapRatio(rankGapRatio: number): RecommendationTier {
  if (rankGapRatio > REACH_GAP_RATIO_LIMIT) return "high_risk";
  if (rankGapRatio >= 0) return "reach";
  if (rankGapRatio >= -0.12) return "match";
  if (rankGapRatio >= -0.3) return "safe";
  return "very_safe";
}

export function getTierByRankGap(rankGap: number, referenceRank: number): RecommendationTier {
  const rankGapRatio = rankGap / referenceRank;

  if (rankGap >= 0) {
    const candidateRank = referenceRank + rankGap;
    const reachGapLimit = Math.max(referenceRank * REACH_GAP_RATIO_LIMIT, getReachAbsoluteGapLimit(candidateRank));
    return rankGap <= reachGapLimit ? "reach" : "high_risk";
  }

  const rankAdvantage = Math.abs(rankGap);

  if (rankGapRatio >= -0.12) return "match";

  const safeAdvantageLimit = Math.max(referenceRank * 0.3, MIN_SAFE_ABSOLUTE_ADVANTAGE);
  return rankAdvantage <= safeAdvantageLimit ? "safe" : "very_safe";
}

export const tierLabels: Record<RecommendationTier, string> = {
  reach: "冲",
  match: "稳",
  safe: "保",
  very_safe: "过保",
  high_risk: "高危",
};
