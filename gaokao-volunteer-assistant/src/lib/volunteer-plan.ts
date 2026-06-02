export const VOLUNTEER_PLAN_LIMIT = 45;

export const volunteerPlanSuggestedRanges = {
  reach: { min: 8, max: 12 },
  match: { min: 20, max: 25 },
  safe: { min: 8, max: 12 },
  very_safe: { min: 1, max: 3 },
} as const;

export type VolunteerPlanTier = "reach" | "match" | "safe" | "very_safe" | "high_risk";
export type VolunteerPlanRatioTier = keyof typeof volunteerPlanSuggestedRanges;

export type VolunteerPlanReference = {
  planKey: string;
  tier: VolunteerPlanTier | null;
};

export type VolunteerPlanIssue = {
  code: "EMPTY" | "INCOMPLETE" | "SAFETY_NOT_ENOUGH" | "REACH_TOO_MANY" | "MATCH_NOT_ENOUGH" | "HIGH_RISK_INCLUDED";
  message: string;
  severity: "info" | "warning" | "danger";
};

export function canAddVolunteerPlanItem(
  currentItems: VolunteerPlanReference[],
  nextItem: VolunteerPlanReference,
) {
  if (currentItems.some((item) => item.planKey === nextItem.planKey)) {
    return { ok: false, reason: "该院校专业组已在志愿表中" };
  }

  if (currentItems.length >= VOLUNTEER_PLAN_LIMIT) {
    return { ok: false, reason: `志愿表最多 ${VOLUNTEER_PLAN_LIMIT} 个院校专业组` };
  }

  return { ok: true, reason: null };
}

export function moveVolunteerPlanItem<T>(items: T[], index: number, direction: "up" | "down") {
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || index >= items.length || targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];

  return nextItems;
}

export function analyzeVolunteerPlan(items: VolunteerPlanReference[]) {
  const tierCounts: Record<VolunteerPlanTier | "unranked", number> = {
    reach: 0,
    match: 0,
    safe: 0,
    very_safe: 0,
    high_risk: 0,
    unranked: 0,
  };

  for (const item of items) {
    if (item.tier) {
      tierCounts[item.tier] += 1;
    } else {
      tierCounts.unranked += 1;
    }
  }

  const safetyCount = tierCounts.safe + tierCounts.very_safe;
  const issues: VolunteerPlanIssue[] = [];

  if (items.length === 0) {
    issues.push({
      code: "EMPTY",
      message: "志愿表为空",
      severity: "info",
    });
  } else if (items.length < VOLUNTEER_PLAN_LIMIT) {
    issues.push({
      code: "INCOMPLETE",
      message: `还可加入 ${VOLUNTEER_PLAN_LIMIT - items.length} 个志愿`,
      severity: "info",
    });
  }

  if (items.length > 0 && safetyCount < volunteerPlanSuggestedRanges.safe.min) {
    issues.push({
      code: "SAFETY_NOT_ENOUGH",
      message: "保底不足，建议补足保和过保志愿",
      severity: "danger",
    });
  }

  if (tierCounts.reach > volunteerPlanSuggestedRanges.reach.max) {
    issues.push({
      code: "REACH_TOO_MANY",
      message: "冲刺志愿偏多",
      severity: "warning",
    });
  }

  if (items.length >= 30 && tierCounts.match < volunteerPlanSuggestedRanges.match.min) {
    issues.push({
      code: "MATCH_NOT_ENOUGH",
      message: "稳妥志愿偏少",
      severity: "warning",
    });
  }

  if (tierCounts.high_risk > 0) {
    issues.push({
      code: "HIGH_RISK_INCLUDED",
      message: "志愿表包含高危项",
      severity: "danger",
    });
  }

  return {
    total: items.length,
    limit: VOLUNTEER_PLAN_LIMIT,
    remaining: Math.max(VOLUNTEER_PLAN_LIMIT - items.length, 0),
    isFull: items.length >= VOLUNTEER_PLAN_LIMIT,
    tierCounts,
    safetyCount,
    hasEnoughSafety: safetyCount >= volunteerPlanSuggestedRanges.safe.min,
    suggestedRanges: volunteerPlanSuggestedRanges,
    issues,
  };
}
