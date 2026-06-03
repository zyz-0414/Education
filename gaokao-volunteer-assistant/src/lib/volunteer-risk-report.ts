import { volunteerPlanSuggestedRanges } from "@/lib/volunteer-plan";

export const HIGH_TUITION_THRESHOLD = 20000;

export type VolunteerRiskReportTier = "reach" | "match" | "safe" | "very_safe" | "high_risk";

export type VolunteerRiskReportProfile = {
  targetYear?: number;
  firstChoiceSubject?: "physics" | "history";
  score?: number;
  rank?: number;
  riskPreference?: "conservative" | "balanced" | "aggressive";
} | null;

export type VolunteerRiskReportPreferences = {
  tuitionLimit?: number;
  rejectedMajorCategories?: string[];
};

export type VolunteerRiskReportMajorPlan = {
  majorName: string;
  tuition: number | null;
  note?: string | null;
};

export type VolunteerRiskReportItem = {
  planKey: string;
  collegeName: string;
  collegeCode: string;
  groupCode: string;
  tier: VolunteerRiskReportTier | null;
  tierLabel?: string;
  referenceRank?: number | null;
  rankGapRatio?: number | null;
  lowConfidence?: boolean;
  confidenceReasons?: string[];
  preferencePenalties?: string[];
  majorPlans: VolunteerRiskReportMajorPlan[];
  eligiblePlanCount?: number;
};

export type VolunteerRiskReportIssueCode =
  | "EMPTY_PLAN"
  | "SLIDING_RISK"
  | "SAFETY_NOT_ENOUGH"
  | "REJECTED_MAJOR"
  | "HIGH_TUITION"
  | "LOW_CONFIDENCE";

export type VolunteerRiskReportSeverity = "info" | "warning" | "danger";

export type VolunteerRiskEvidence = {
  planKey: string;
  collegeName: string;
  groupCode: string;
  tierLabel: string;
  reasons: string[];
  majorNames: string[];
};

export type VolunteerRiskReportIssue = {
  code: VolunteerRiskReportIssueCode;
  title: string;
  message: string;
  severity: VolunteerRiskReportSeverity;
  evidence: VolunteerRiskEvidence[];
};

export type VolunteerRiskReportStatus = "empty" | "ready" | "needs_attention" | "high_risk";

export type VolunteerRiskReport = {
  generatedAt: string;
  status: VolunteerRiskReportStatus;
  statusLabel: string;
  conclusion: string;
  metrics: {
    total: number;
    tierCounts: Record<VolunteerRiskReportTier | "unranked", number>;
    safetyCount: number;
    reachOrHighRiskCount: number;
    lowConfidenceCount: number;
    rejectedMajorGroupCount: number;
    highTuitionGroupCount: number;
    maxKnownTuition: number | null;
  };
  issues: VolunteerRiskReportIssue[];
  actionItems: string[];
};

function emptyTierCounts(): Record<VolunteerRiskReportTier | "unranked", number> {
  return {
    reach: 0,
    match: 0,
    safe: 0,
    very_safe: 0,
    high_risk: 0,
    unranked: 0,
  };
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeKeywords(values: string[] | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function includesAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getTierLabel(item: VolunteerRiskReportItem) {
  return item.tierLabel ?? (item.tier ? item.tier : "待确认");
}

function toEvidence(
  item: VolunteerRiskReportItem,
  reasons: string[],
  majorNames: string[] = [],
): VolunteerRiskEvidence {
  return {
    planKey: item.planKey,
    collegeName: item.collegeName,
    groupCode: item.groupCode,
    tierLabel: getTierLabel(item),
    reasons,
    majorNames: Array.from(new Set(majorNames)),
  };
}

function getRejectedMajorEvidence(
  item: VolunteerRiskReportItem,
  rejectedKeywords: string[],
): VolunteerRiskEvidence | null {
  const hasPreferencePenalty = (item.preferencePenalties ?? []).some((reason) => reason.includes("排斥"));
  const matchedPlans = item.majorPlans.filter((plan) => {
    const text = `${normalizeText(plan.majorName)} ${normalizeText(plan.note)}`;
    return rejectedKeywords.length > 0 && includesAnyKeyword(text, rejectedKeywords);
  });

  if (!hasPreferencePenalty && matchedPlans.length === 0) {
    return null;
  }

  const reasons =
    matchedPlans.length > 0
      ? [`命中排斥方向：${rejectedKeywords.join("、")}`]
      : ["命中画像中的排斥方向"];

  return toEvidence(
    item,
    reasons,
    matchedPlans.length > 0 ? matchedPlans.map((plan) => plan.majorName) : item.majorPlans.map((plan) => plan.majorName),
  );
}

function isHighTuitionPlan(plan: VolunteerRiskReportMajorPlan, tuitionLimit: number | undefined) {
  const note = normalizeText(plan.note);
  const markedHighTuition = /高学费|较高学费|中外合作|合作办学/.test(note);
  const overBudget = tuitionLimit !== undefined && plan.tuition !== null && plan.tuition > tuitionLimit;
  const overDefaultThreshold = plan.tuition !== null && plan.tuition >= HIGH_TUITION_THRESHOLD;

  return overBudget || overDefaultThreshold || markedHighTuition;
}

function getHighTuitionEvidence(
  item: VolunteerRiskReportItem,
  tuitionLimit: number | undefined,
): VolunteerRiskEvidence | null {
  const highTuitionPlans = item.majorPlans.filter((plan) => isHighTuitionPlan(plan, tuitionLimit));

  if (highTuitionPlans.length === 0) {
    return null;
  }

  const reasons = new Set<string>();

  for (const plan of highTuitionPlans) {
    if (tuitionLimit !== undefined && plan.tuition !== null && plan.tuition > tuitionLimit) {
      reasons.add(`超过预算上限 ${tuitionLimit.toLocaleString("zh-CN")} 元/年`);
    }

    if (plan.tuition !== null && plan.tuition >= HIGH_TUITION_THRESHOLD) {
      reasons.add(`达到高学费阈值 ${HIGH_TUITION_THRESHOLD.toLocaleString("zh-CN")} 元/年`);
    }

    if (/高学费|较高学费|中外合作|合作办学/.test(normalizeText(plan.note))) {
      reasons.add("备注含高学费或合作办学提示");
    }
  }

  return toEvidence(
    item,
    Array.from(reasons),
    highTuitionPlans.map((plan) =>
      plan.tuition === null ? plan.majorName : `${plan.majorName} ${plan.tuition.toLocaleString("zh-CN")} 元/年`,
    ),
  );
}

function getLowConfidenceEvidence(item: VolunteerRiskReportItem) {
  if (!item.lowConfidence) {
    return null;
  }

  return toEvidence(
    item,
    (item.confidenceReasons ?? []).length > 0 ? item.confidenceReasons ?? [] : ["推荐模型低置信度"],
  );
}

function getSlidingRiskEvidence(items: VolunteerRiskReportItem[]) {
  return items
    .filter((item) => item.tier === "high_risk" || item.tier === "reach")
    .map((item) => {
      const reasons = item.tier === "high_risk" ? ["高危项进入方案"] : ["冲刺项需要控制数量"];
      if (typeof item.rankGapRatio === "number") {
        reasons.push(`位次差 ${(item.rankGapRatio * 100).toFixed(1)}%`);
      }

      return toEvidence(item, reasons);
    });
}

function buildActionItems(issues: VolunteerRiskReportIssue[]) {
  const items: string[] = [];
  const issueCodes = new Set(issues.map((issue) => issue.code));

  if (issueCodes.has("SLIDING_RISK")) {
    items.push("减少高危项，控制冲刺数量，优先把前段志愿换成更接近参考位次的冲或稳。");
  }

  if (issueCodes.has("SAFETY_NOT_ENOUGH")) {
    items.push("补足保和过保志愿，再检查这些专业组是否仍在专业、城市和学费可接受范围内。");
  }

  if (issueCodes.has("REJECTED_MAJOR")) {
    items.push("逐组核对排斥专业，尤其在接受调剂时不要把强排斥方向放进保底位。");
  }

  if (issueCodes.has("HIGH_TUITION")) {
    items.push("确认家庭预算、合作办学规则和校区费用，把不可接受的高学费专业组移出方案。");
  }

  if (issueCodes.has("LOW_CONFIDENCE")) {
    items.push("低置信度专业组需要人工复核历史位次和计划变动，避免把它们集中放在同一风险区间。");
  }

  if (items.length === 0) {
    items.push("当前方案未触发核心风险，后续可继续补充招生章程、体检和语种规则。");
  }

  return items;
}

export function buildVolunteerRiskReport(
  items: VolunteerRiskReportItem[],
  options: {
    profile?: VolunteerRiskReportProfile;
    preferences?: VolunteerRiskReportPreferences | null;
    generatedAt?: string;
  } = {},
): VolunteerRiskReport {
  const tierCounts = emptyTierCounts();
  const rejectedKeywords = normalizeKeywords(options.preferences?.rejectedMajorCategories);
  const tuitionLimit = options.preferences?.tuitionLimit;
  const rejectedMajorEvidence: VolunteerRiskEvidence[] = [];
  const highTuitionEvidence: VolunteerRiskEvidence[] = [];
  const lowConfidenceEvidence: VolunteerRiskEvidence[] = [];
  const knownTuitions: number[] = [];

  for (const item of items) {
    tierCounts[item.tier ?? "unranked"] += 1;

    const rejectedEvidence = getRejectedMajorEvidence(item, rejectedKeywords);
    if (rejectedEvidence) {
      rejectedMajorEvidence.push(rejectedEvidence);
    }

    const tuitionEvidence = getHighTuitionEvidence(item, tuitionLimit);
    if (tuitionEvidence) {
      highTuitionEvidence.push(tuitionEvidence);
    }

    const confidenceEvidence = getLowConfidenceEvidence(item);
    if (confidenceEvidence) {
      lowConfidenceEvidence.push(confidenceEvidence);
    }

    for (const plan of item.majorPlans) {
      if (plan.tuition !== null) {
        knownTuitions.push(plan.tuition);
      }
    }
  }

  const total = items.length;
  const safetyCount = tierCounts.safe + tierCounts.very_safe;
  const reachOrHighRiskCount = tierCounts.reach + tierCounts.high_risk;
  const issues: VolunteerRiskReportIssue[] = [];

  if (total === 0) {
    issues.push({
      code: "EMPTY_PLAN",
      title: "志愿表为空",
      message: "尚未形成可检测的志愿方案。",
      severity: "info",
      evidence: [],
    });
  }

  if (tierCounts.high_risk > 0 || tierCounts.reach > volunteerPlanSuggestedRanges.reach.max) {
    const highRiskMessage =
      tierCounts.high_risk > 0
        ? `方案中包含 ${tierCounts.high_risk} 个高危项，存在滑档风险。`
        : `冲刺志愿 ${tierCounts.reach} 个，超过建议上限 ${volunteerPlanSuggestedRanges.reach.max} 个。`;

    issues.push({
      code: "SLIDING_RISK",
      title: "滑档风险",
      message: highRiskMessage,
      severity: tierCounts.high_risk > 0 ? "danger" : "warning",
      evidence: getSlidingRiskEvidence(items),
    });
  }

  if (total > 0 && safetyCount < volunteerPlanSuggestedRanges.safe.min) {
    issues.push({
      code: "SAFETY_NOT_ENOUGH",
      title: "保底不足",
      message: `保和过保合计 ${safetyCount} 个，低于建议下限 ${volunteerPlanSuggestedRanges.safe.min} 个。`,
      severity: "danger",
      evidence: items
        .filter((item) => item.tier === "safe" || item.tier === "very_safe")
        .map((item) => toEvidence(item, ["当前保底候选"])),
    });
  }

  if (rejectedMajorEvidence.length > 0) {
    issues.push({
      code: "REJECTED_MAJOR",
      title: "专业组排斥专业",
      message: `${rejectedMajorEvidence.length} 个院校专业组含排斥方向，需要核对调剂风险。`,
      severity: "danger",
      evidence: rejectedMajorEvidence,
    });
  }

  if (highTuitionEvidence.length > 0) {
    issues.push({
      code: "HIGH_TUITION",
      title: "高学费",
      message: `${highTuitionEvidence.length} 个院校专业组触发高学费或预算风险。`,
      severity: "warning",
      evidence: highTuitionEvidence,
    });
  }

  if (lowConfidenceEvidence.length > 0) {
    issues.push({
      code: "LOW_CONFIDENCE",
      title: "低置信度",
      message: `${lowConfidenceEvidence.length} 个院校专业组历史数据或模型依据不完整。`,
      severity: "warning",
      evidence: lowConfidenceEvidence,
    });
  }

  const hasDanger = issues.some((issue) => issue.severity === "danger");
  const hasWarning = issues.some((issue) => issue.severity === "warning");
  const status: VolunteerRiskReportStatus =
    total === 0 ? "empty" : hasDanger ? "high_risk" : hasWarning ? "needs_attention" : "ready";
  const statusLabel =
    status === "empty" ? "待生成" : status === "high_risk" ? "需调整" : status === "needs_attention" ? "需复核" : "可解释";
  const rankLabel = options.profile?.rank ? `，考生位次 ${options.profile.rank.toLocaleString("zh-CN")}` : "";
  const conclusion =
    status === "empty"
      ? "先从推荐结果加入院校专业组，再生成方案风险报告。"
      : status === "high_risk"
        ? `当前方案存在关键风险${rankLabel}，建议调整后再用于家长或老师沟通。`
        : status === "needs_attention"
          ? `当前方案已形成基本结构${rankLabel}，但仍有数据或费用事项需要复核。`
          : `当前方案结构较均衡${rankLabel}，未触发核心风险。`;

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    status,
    statusLabel,
    conclusion,
    metrics: {
      total,
      tierCounts,
      safetyCount,
      reachOrHighRiskCount,
      lowConfidenceCount: lowConfidenceEvidence.length,
      rejectedMajorGroupCount: rejectedMajorEvidence.length,
      highTuitionGroupCount: highTuitionEvidence.length,
      maxKnownTuition: knownTuitions.length > 0 ? Math.max(...knownTuitions) : null,
    },
    issues,
    actionItems: buildActionItems(issues),
  };
}
