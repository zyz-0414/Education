export type RecommendationTier = "reach" | "match" | "safe" | "very_safe" | "high_risk";

export function getTierByRankGapRatio(rankGapRatio: number): RecommendationTier {
  if (rankGapRatio > 0.08) return "high_risk";
  if (rankGapRatio >= 0) return "reach";
  if (rankGapRatio >= -0.12) return "match";
  if (rankGapRatio >= -0.3) return "safe";
  return "very_safe";
}

export const tierLabels: Record<RecommendationTier, string> = {
  reach: "冲",
  match: "稳",
  safe: "保",
  very_safe: "过保",
  high_risk: "高危",
};
