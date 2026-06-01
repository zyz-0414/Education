import type { CandidateProfile } from "@/lib/validators/profile";
import type { RecommendationTier } from "./tier";

type PreferencePlan = {
  majorName: string;
  tuition: number | null;
  note?: string | null;
};

export type PreferenceScoreInput = {
  tier: RecommendationTier | null;
  city: string | null;
  province: string | null;
  plans: PreferencePlan[];
  hasEligiblePlan: boolean;
};

export type PreferenceScoreResult = {
  score: number;
  matches: string[];
  penalties: string[];
};

const tierFitScores: Record<CandidateProfile["riskPreference"], Record<RecommendationTier, number>> = {
  aggressive: {
    reach: 34,
    match: 28,
    safe: 16,
    very_safe: 6,
    high_risk: -24,
  },
  balanced: {
    reach: 26,
    match: 34,
    safe: 24,
    very_safe: 10,
    high_risk: -28,
  },
  conservative: {
    reach: 12,
    match: 28,
    safe: 34,
    very_safe: 24,
    high_risk: -36,
  },
};

const riskPreferenceLabels: Record<CandidateProfile["riskPreference"], string> = {
  aggressive: "进取",
  balanced: "均衡",
  conservative: "稳妥",
};

function includesPreference(text: string, preferences: string[]) {
  return preferences.some((preference) => preference.trim() && text.includes(preference.trim()));
}

export function calculatePreferenceScore(
  profile: CandidateProfile,
  input: PreferenceScoreInput,
): PreferenceScoreResult {
  const matches: string[] = [];
  const penalties: string[] = [];
  let score = input.tier ? tierFitScores[profile.riskPreference][input.tier] : -20;

  if (input.tier) {
    matches.push(`风险偏好匹配：${riskPreferenceLabels[profile.riskPreference]}`);
  } else {
    penalties.push("缺少参考位次，无法按风险偏好精确排序");
  }

  const normalizedCities = profile.preferredCities.map((city) => city.trim()).filter(Boolean);
  if (normalizedCities.length > 0) {
    if (
      (input.city && normalizedCities.includes(input.city)) ||
      (input.province && normalizedCities.includes(input.province))
    ) {
      score += 12;
      matches.push("城市偏好命中");
    } else {
      score -= 6;
      penalties.push("未命中城市偏好");
    }
  }

  const planText = input.plans.map((plan) => `${plan.majorName} ${plan.note ?? ""}`).join(" ");
  if (profile.preferredMajorCategories.length > 0) {
    if (includesPreference(planText, profile.preferredMajorCategories)) {
      score += 14;
      matches.push("专业偏好命中");
    } else {
      score -= 4;
      penalties.push("未命中专业偏好");
    }
  }

  if (profile.rejectedMajorCategories.length > 0 && includesPreference(planText, profile.rejectedMajorCategories)) {
    score -= 26;
    penalties.push("包含排斥专业方向");
  }

  const tuitionLimit = profile.tuitionLimit;
  if (tuitionLimit !== undefined && input.plans.length > 0) {
    const affordablePlans = input.plans.filter((plan) => plan.tuition !== null && plan.tuition <= tuitionLimit);
    const overLimitPlans = input.plans.filter((plan) => plan.tuition !== null && plan.tuition > tuitionLimit);

    if (affordablePlans.length > 0) {
      score += 6;
      matches.push("存在学费预算内专业");
    }

    if (overLimitPlans.length === input.plans.length) {
      score -= 18;
      penalties.push("已知专业学费均超过预算");
    } else if (overLimitPlans.length > 0) {
      score -= 8;
      penalties.push("部分专业学费超过预算");
    }
  }

  if (input.hasEligiblePlan) {
    score += 8;
    matches.push("已有可报计划明细");
  } else {
    score -= 10;
    penalties.push("招生计划明细待补");
  }

  return {
    score: Math.round(score),
    matches,
    penalties,
  };
}
