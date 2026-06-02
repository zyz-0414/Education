"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Check,
  CircleAlert,
  ClipboardList,
  Database,
  ExternalLink,
  Filter,
  GraduationCap,
  Info,
  Landmark,
  LineChart,
  ListChecks,
  Loader2,
  MapPin,
  Medal,
  Plus,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeVolunteerPlan,
  canAddVolunteerPlanItem,
  moveVolunteerPlanItem,
  VOLUNTEER_PLAN_LIMIT,
  type VolunteerPlanRatioTier,
  type VolunteerPlanReference,
} from "@/lib/volunteer-plan";

type FirstChoiceSubject = "physics" | "history";
type SecondChoiceSubject = "chemistry" | "biology" | "politics" | "geography";
type RiskPreference = "conservative" | "balanced" | "aggressive";
type RecommendationTier = "reach" | "match" | "safe" | "very_safe" | "high_risk";
type RiskTone = "accent" | "warning" | "danger" | "neutral" | "info";

type SourceInfo = {
  id?: string;
  title: string;
  sourceUrl: string;
  publisher?: string | null;
  reviewStatus: string;
};

type MajorPlan = {
  majorCode: string;
  majorName: string;
  subjectRequirement: string | null;
  planCount: number;
  tuition: number | null;
  duration: string | null;
  campus: string | null;
  note: string | null;
  source: SourceInfo;
};

type AdmissionResult = {
  year: number;
  minScore: number | null;
  minRank: number | null;
  avgScore: number | null;
  avgRank: number | null;
  maxScore: number | null;
  maxRank: number | null;
  admittedCount: number | null;
  source: SourceInfo;
};

type RecommendationItem = {
  key: {
    year: number;
    provinceCode: string;
    batchCode: string;
    subjectTrack: FirstChoiceSubject;
    collegeCode: string;
    groupCode: string;
  };
  college: {
    collegeCode: string;
    collegeName: string;
    province: string | null;
    city: string | null;
    level: string | null;
    ownership: string | null;
    officialSite: string | null;
  };
  subjectRequirement: string;
  groupNote: string | null;
  majorPlans: MajorPlan[];
  admissionResults: AdmissionResult[];
  source: SourceInfo;
  eligibility: {
    requirement: string;
    hasEligibleMajorPlan: boolean;
    eligibleMajorPlanCount: number;
    eligiblePlanCount: number;
    latestAdmission: {
      year: number;
      minScore: number | null;
      minRank: number | null;
      admittedCount: number | null;
    } | null;
  };
  recommendation: {
    algorithmVersion: string;
    tier: RecommendationTier | null;
    tierLabel: string;
    referenceRank: number | null;
    rankGap: number | null;
    rankGapRatio: number | null;
    rankFitScore: number;
    preferenceScore: number;
    recommendationScore: number;
    confidence: "medium" | "low";
    lowConfidence: boolean;
    confidenceReasons: string[];
    modelReasons: string[];
    preferenceMatches: string[];
    preferencePenalties: string[];
    historicalRanks: Array<{
      year: number;
      minRank: number;
      scope?: "group" | "college_fallback" | "legacy_college";
      label?: string;
      note?: string;
    }>;
    planChangeRatio: number;
    volatilityRatio: number | null;
    explanations: string[];
  };
};

type RecommendationResult = {
  profile: {
    targetYear: number;
    firstChoiceSubject: FirstChoiceSubject;
    score: number;
    rank: number;
    riskPreference: RiskPreference;
  };
  algorithm: {
    version: string;
    dataVersion: string;
    referenceYears: number[];
  };
  scoreRankCheck: {
    valid: boolean;
    issues: Array<{ code: string; message: string; severity: "error" | "warning" }>;
    segment: {
      score: number;
      count: number;
      cumulativeCount: number;
      rankMin: number | null;
      rankMax: number | null;
      source: SourceInfo;
    } | null;
  };
  filters: {
    batchCount: number;
    subjectTrackCount: number;
    subjectMatchedCount: number;
    subjectMismatchCount: number;
    noEligiblePlanCount: number;
    requirePlan: boolean;
    recommendableCount: number;
    lowConfidenceCount: number;
    tierCounts: Record<RecommendationTier | "unranked", number>;
    includeHighRisk: boolean;
    includeVerySafe: boolean;
  };
  total: number;
  limit: number;
  offset: number;
  items: RecommendationItem[];
};

const firstChoiceOptions: Array<{ value: FirstChoiceSubject; label: string }> = [
  { value: "physics", label: "物理" },
  { value: "history", label: "历史" },
];

const secondChoiceOptions: Array<{ value: SecondChoiceSubject; label: string }> = [
  { value: "chemistry", label: "化学" },
  { value: "biology", label: "生物" },
  { value: "politics", label: "思想政治" },
  { value: "geography", label: "地理" },
];

const riskOptions: Array<{ value: RiskPreference; label: string }> = [
  { value: "balanced", label: "均衡" },
  { value: "conservative", label: "稳妥" },
  { value: "aggressive", label: "进取" },
];

const tierOrder: RecommendationTier[] = ["high_risk", "reach", "match", "safe", "very_safe"];
const volunteerRatioOrder: VolunteerPlanRatioTier[] = ["reach", "match", "safe", "very_safe"];
const volunteerPlanStorageKey = "gaokao-volunteer-plan-v1";

const tierLabels: Record<RecommendationTier, string> = {
  reach: "冲",
  match: "稳",
  safe: "保",
  very_safe: "过保",
  high_risk: "高危",
};

const tierDescriptions: Record<RecommendationTier, string> = {
  reach: "略有机会，适合少量冲刺",
  match: "位次接近，重点关注",
  safe: "位次优势较明显",
  very_safe: "较保守，可作兜底",
  high_risk: "风险偏高，谨慎纳入",
};

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("zh-CN") : "暂无";
}

function formatSignedPercent(value: number | null | undefined) {
  if (typeof value !== "number") return "暂无";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function getHistoricalRankLabel(rank: RecommendationItem["recommendation"]["historicalRanks"][number]) {
  if (rank.label) return rank.label;
  if (rank.scope === "college_fallback") return `${rank.year} 同院校专业组参考`;
  return rank.scope === "legacy_college" ? `${rank.year} 旧文理科院校线` : `${rank.year} 专业组投档线`;
}

function formatCompactHistoricalRanks(item: RecommendationItem) {
  if (!item.recommendation.historicalRanks.length) return "暂无";
  return item.recommendation.historicalRanks
    .slice(0, 3)
    .map((rank) => `${rank.year}: ${formatNumber(rank.minRank)}`)
    .join(" / ");
}

function getSubjectTrackLabel(value: FirstChoiceSubject) {
  return value === "physics" ? "物理类" : "历史类";
}

function getRiskPreferenceLabel(value: RiskPreference) {
  return riskOptions.find((option) => option.value === value)?.label ?? "均衡";
}

function splitTextInput(value: string) {
  return value
    .split(/[,\n，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getItemKey(item: RecommendationItem) {
  return `${item.key.year}-${item.key.subjectTrack}-${item.key.collegeCode}-${item.key.groupCode}`;
}

type StoredVolunteerPlanDraft = {
  version: 1;
  savedAt: string;
  profile: RecommendationResult["profile"] | null;
  items: RecommendationItem[];
};

function isStoredVolunteerPlanDraft(value: unknown): value is StoredVolunteerPlanDraft {
  if (typeof value !== "object" || value === null) return false;

  const draft = value as { items?: unknown; savedAt?: unknown };

  return Array.isArray(draft.items) && typeof draft.savedAt === "string";
}

function toVolunteerPlanReference(item: RecommendationItem): VolunteerPlanReference {
  return {
    planKey: getItemKey(item),
    tier: item.recommendation.tier,
  };
}

function getDetailHref(item: RecommendationItem) {
  return `/api/college-groups/${item.key.year}/${item.key.subjectTrack}/${item.key.collegeCode}/${item.key.groupCode}`;
}

function getTierClass(tier: RecommendationTier | null) {
  switch (tier) {
    case "reach":
      return "border-info bg-info-soft text-info";
    case "match":
      return "border-accent bg-accent-soft text-accent-strong";
    case "safe":
      return "border-success bg-success-soft text-success";
    case "very_safe":
      return "border-line bg-background text-muted";
    case "high_risk":
      return "border-danger bg-danger-soft text-danger";
    default:
      return "border-warning bg-warning-soft text-warning";
  }
}

function getRiskToneClass(tone: RiskTone) {
  switch (tone) {
    case "accent":
      return "border-accent bg-accent-soft text-accent-strong";
    case "warning":
      return "border-warning bg-warning-soft text-warning";
    case "danger":
      return "border-danger bg-danger-soft text-danger";
    case "info":
      return "border-info bg-info-soft text-info";
    default:
      return "border-line bg-background text-muted";
  }
}

function getVolunteerIssueClass(severity: "info" | "warning" | "danger") {
  switch (severity) {
    case "danger":
      return "border-danger bg-danger-soft text-danger";
    case "warning":
      return "border-warning bg-warning-soft text-warning";
    default:
      return "border-info bg-info-soft text-info";
  }
}

function getVolunteerRatioClass(
  tier: VolunteerPlanRatioTier,
  count: number,
  total: number,
  range: { min: number; max: number },
) {
  if (count >= range.min && count <= range.max) {
    return "bg-accent";
  }

  if (count > range.max || (total > 0 && (tier === "safe" || tier === "very_safe") && count < range.min)) {
    return "bg-warning";
  }

  return "bg-muted";
}

function formatSavedTime(value: string | null) {
  if (!value) return "未保存";

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRiskPills(item: RecommendationItem): Array<{ label: string; tone: RiskTone }> {
  const pills: Array<{ label: string; tone: RiskTone }> = [];

  if (item.recommendation.tier === "high_risk") {
    pills.push({ label: "高危", tone: "danger" });
  }

  if (item.recommendation.lowConfidence) {
    pills.push({ label: "低置信度", tone: "warning" });
  }

  if (!item.eligibility.hasEligibleMajorPlan) {
    pills.push({ label: "计划待补", tone: "warning" });
  }

  if (item.recommendation.preferencePenalties.some((reason) => reason.includes("学费"))) {
    pills.push({ label: "学费风险", tone: "warning" });
  }

  if (item.recommendation.preferencePenalties.some((reason) => reason.includes("排斥"))) {
    pills.push({ label: "含排斥方向", tone: "danger" });
  }

  if (item.recommendation.confidenceReasons.some((reason) => reason.includes("OCR"))) {
    pills.push({ label: "OCR 待复核", tone: "neutral" });
  }

  if (pills.length === 0) {
    pills.push({ label: "规则通过", tone: "accent" });
  }

  return pills;
}

function TierBadge({ tier, label }: { tier: RecommendationTier | null; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold ${getTierClass(tier)}`}>
      <Medal aria-hidden className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function RiskPill({ label, tone }: { label: string; tone: RiskTone }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${getRiskToneClass(tone)}`}>
      {label}
    </span>
  );
}

function MetricBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className="text-accent">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function handleKeyboardSelect(event: React.KeyboardEvent<HTMLElement>, onSelect: () => void) {
  if (event.currentTarget !== event.target) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

function RecommendationCard({
  item,
  selected,
  inVolunteerPlan,
  planFull,
  onSelect,
  onAdd,
}: {
  item: RecommendationItem;
  selected: boolean;
  inVolunteerPlan: boolean;
  planFull: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) {
  const addDisabled = inVolunteerPlan || (!inVolunteerPlan && planFull);

  return (
    <article
      className={`cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition hover:border-accent hover:bg-background/60 ${
        selected ? "border-accent bg-accent-soft/50" : "border-line"
      }`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => handleKeyboardSelect(event, onSelect)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <TierBadge tier={item.recommendation.tier} label={item.recommendation.tierLabel} />
          <h3 className="mt-3 text-base font-semibold">{item.college.collegeName}</h3>
          <p className="mt-1 text-sm text-muted">
            {item.key.collegeCode}-{item.key.groupCode} · {item.college.city ?? "城市待补"} ·{" "}
            {item.eligibility.requirement}
          </p>
        </div>
        <button
          aria-label={inVolunteerPlan ? "已加入志愿表" : "加入志愿表"}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border text-sm font-semibold transition disabled:cursor-not-allowed ${
            inVolunteerPlan
              ? "border-success bg-success-soft text-success disabled:opacity-80"
              : "border-line bg-white text-foreground hover:border-accent hover:text-accent disabled:opacity-50"
          }`}
          disabled={addDisabled}
          title={inVolunteerPlan ? "已加入志愿表" : "加入志愿表"}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
        >
          {inVolunteerPlan ? <Check aria-hidden className="h-4 w-4" /> : <Plus aria-hidden className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded border border-line bg-background p-2">
          <p className="text-xs text-muted">参考位次</p>
          <p className="mt-1 font-semibold">{formatNumber(item.recommendation.referenceRank)}</p>
        </div>
        <div className="rounded border border-line bg-background p-2">
          <p className="text-xs text-muted">位次差</p>
          <p className="mt-1 font-semibold">{formatSignedPercent(item.recommendation.rankGapRatio)}</p>
        </div>
        <div className="rounded border border-line bg-background p-2">
          <p className="text-xs text-muted">综合分</p>
          <p className="mt-1 font-semibold">{item.recommendation.recommendationScore}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {getRiskPills(item).slice(0, 4).map((pill) => (
          <RiskPill key={pill.label} label={pill.label} tone={pill.tone} />
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">{item.recommendation.explanations[0] ?? "暂无推荐理由"}</p>
    </article>
  );
}

function RecommendationDetailPanel({
  item,
  profile,
  inVolunteerPlan = false,
  planFull = false,
  onAdd,
}: {
  item: RecommendationItem | null;
  profile: RecommendationResult["profile"] | null;
  inVolunteerPlan?: boolean;
  planFull?: boolean;
  onAdd?: () => void;
}) {
  if (!item) {
    return (
      <aside className="rounded-lg border border-dashed border-line bg-panel p-6 text-sm text-muted xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:self-start xl:overflow-y-auto xl:[scrollbar-gutter:stable]">
        <Info aria-hidden className="mb-3 h-5 w-5 text-accent" />
        选择一条推荐后查看院校专业组详情、风险标签和推荐理由。
      </aside>
    );
  }

  const riskPills = getRiskPills(item);
  const detailHref = getDetailHref(item);
  const addDisabled = inVolunteerPlan || (!inVolunteerPlan && planFull) || !onAdd;

  return (
    <aside className="rounded-lg border border-line bg-panel p-5 shadow-sm xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:self-start xl:overflow-y-auto xl:[scrollbar-gutter:stable]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <TierBadge tier={item.recommendation.tier} label={item.recommendation.tierLabel} />
          <h3 className="mt-3 text-lg font-semibold">{item.college.collegeName}</h3>
          <p className="mt-1 text-sm text-muted">
            {item.key.collegeCode}-{item.key.groupCode} · {item.college.province ?? "省份待补"}
            {item.college.city ? ` ${item.college.city}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label={inVolunteerPlan ? "已加入志愿表" : "加入志愿表"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded border transition disabled:cursor-not-allowed ${
              inVolunteerPlan
                ? "border-success bg-success-soft text-success disabled:opacity-80"
                : "border-line text-muted hover:border-accent hover:text-accent disabled:opacity-50"
            }`}
            disabled={addDisabled}
            title={inVolunteerPlan ? "已加入志愿表" : "加入志愿表"}
            type="button"
            onClick={onAdd}
          >
            {inVolunteerPlan ? <Check aria-hidden className="h-4 w-4" /> : <Plus aria-hidden className="h-4 w-4" />}
          </button>
          <a
            aria-label="打开院校专业组数据"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-line text-muted transition hover:border-accent hover:text-accent"
            href={detailHref}
            rel="noreferrer"
            target="_blank"
            title="打开院校专业组数据"
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-line bg-background p-3">
          <p className="text-muted">考生位次</p>
          <p className="mt-1 font-semibold">{formatNumber(profile?.rank)}</p>
        </div>
        <div className="rounded border border-line bg-background p-3">
          <p className="text-muted">参考位次</p>
          <p className="mt-1 font-semibold">{formatNumber(item.recommendation.referenceRank)}</p>
        </div>
        <div className="rounded border border-line bg-background p-3">
          <p className="text-muted">招生计划</p>
          <p className="mt-1 font-semibold">{formatNumber(item.eligibility.eligiblePlanCount)} 人</p>
        </div>
        <div className="rounded border border-line bg-background p-3">
          <p className="text-muted">综合分</p>
          <p className="mt-1 font-semibold">{item.recommendation.recommendationScore}</p>
        </div>
      </div>

      <section className="mt-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert aria-hidden className="h-4 w-4 text-warning" />
          风险标签
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {riskPills.map((pill) => (
            <RiskPill key={pill.label} label={pill.label} tone={pill.tone} />
          ))}
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks aria-hidden className="h-4 w-4 text-accent" />
          推荐理由
        </div>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
          {[...item.recommendation.explanations, ...item.recommendation.preferenceMatches]
            .slice(0, 5)
            .map((reason, index) => (
              <li className="rounded border border-line bg-background px-3 py-2" key={`${reason}-${index}`}>
                {reason}
              </li>
            ))}
        </ul>
      </section>

      {item.recommendation.confidenceReasons.length || item.recommendation.preferencePenalties.length ? (
        <section className="mt-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CircleAlert aria-hidden className="h-4 w-4 text-danger" />
            需要复核
          </div>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
            {[...item.recommendation.confidenceReasons, ...item.recommendation.preferencePenalties]
              .slice(0, 5)
              .map((reason, index) => (
                <li className="rounded border border-warning bg-warning-soft px-3 py-2" key={`${reason}-${index}`}>
                  {reason}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <LineChart aria-hidden className="h-4 w-4 text-info" />
          近三年参考位次
        </div>
        <div className="mt-3 grid gap-2">
          {item.recommendation.historicalRanks.length ? (
            item.recommendation.historicalRanks.map((rank) => (
              <div
                className="flex items-start justify-between gap-3 rounded border border-line bg-background px-3 py-2 text-sm"
                key={rank.year}
              >
                <span className="min-w-0 text-muted">
                  <span className="block font-medium text-foreground">{getHistoricalRankLabel(rank)}</span>
                  {rank.note ? <span className="mt-0.5 block text-xs leading-5">{rank.note}</span> : null}
                </span>
                <span className="shrink-0 font-semibold">{formatNumber(rank.minRank)}</span>
              </div>
            ))
          ) : (
            <p className="rounded border border-line bg-background px-3 py-2 text-sm text-muted">
              暂无可用于模型的历史最低位次。
            </p>
          )}
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BookOpenCheck aria-hidden className="h-4 w-4 text-accent" />
          专业计划
        </div>
        <div className="mt-3 grid gap-2">
          {item.majorPlans.slice(0, 6).map((plan) => (
            <div className="rounded border border-line bg-background px-3 py-2 text-sm" key={plan.majorCode}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{plan.majorName}</span>
                <span className="shrink-0 text-muted">{plan.planCount} 人</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {plan.tuition ? `${formatNumber(plan.tuition)} 元/年` : "学费待补"}
                {plan.campus ? ` · ${plan.campus}` : ""}
              </p>
            </div>
          ))}
          {!item.majorPlans.length ? (
            <p className="rounded border border-line bg-background px-3 py-2 text-sm text-muted">暂无专业计划明细。</p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}

type VolunteerPlanAnalysis = ReturnType<typeof analyzeVolunteerPlan>;

function VolunteerPlanEditor({
  items,
  analysis,
  profile,
  savedAt,
  message,
  onMove,
  onRemove,
  onSave,
  onClear,
}: {
  items: RecommendationItem[];
  analysis: VolunteerPlanAnalysis;
  profile: RecommendationResult["profile"] | null;
  savedAt: string | null;
  message: string | null;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (item: RecommendationItem) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const leadIssue =
    analysis.issues.find((issue) => issue.severity === "danger") ??
    analysis.issues.find((issue) => issue.severity === "warning") ??
    analysis.issues[0];

  return (
    <section className="rounded-lg border border-line bg-panel shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardList aria-hidden className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">志愿表编辑器</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted">
            {profile
              ? `${profile.targetYear} · ${getSubjectTrackLabel(profile.firstChoiceSubject)} · ${formatNumber(
                  profile.rank,
                )} 位次`
              : "尚未绑定考生画像"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-line bg-background px-3 py-1 text-sm font-semibold">
            {analysis.total}/{analysis.limit}
          </span>
          <button
            className="inline-flex h-9 items-center gap-2 rounded border border-line px-3 text-xs font-semibold text-foreground hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!items.length}
            title="保存方案"
            type="button"
            onClick={onSave}
          >
            <Save aria-hidden className="h-4 w-4" />
            保存
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded border border-line px-3 text-xs font-semibold text-muted hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!items.length}
            title="清空志愿表"
            type="button"
            onClick={onClear}
          >
            <Trash2 aria-hidden className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded border border-line bg-background p-3">
            <p className="text-muted">剩余名额</p>
            <p className="mt-1 text-xl font-semibold">{analysis.remaining}</p>
          </div>
          <div className="rounded border border-line bg-background p-3">
            <p className="text-muted">保底数量</p>
            <p className="mt-1 text-xl font-semibold">{analysis.safetyCount}</p>
          </div>
          <div className="rounded border border-line bg-background p-3">
            <p className="text-muted">保存状态</p>
            <p className="mt-1 text-xl font-semibold">{formatSavedTime(savedAt)}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {volunteerRatioOrder.map((tier) => {
            const range = analysis.suggestedRanges[tier];
            const count = analysis.tierCounts[tier];
            const width = Math.min((count / range.max) * 100, 100);

            return (
              <div className="rounded border border-line bg-background p-3" key={tier}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{tierLabels[tier]}</span>
                  <span className="text-muted">
                    {count}/{range.min}-{range.max}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded bg-line">
                  <div
                    className={`h-full rounded ${getVolunteerRatioClass(tier, count, analysis.total, range)}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {leadIssue || message ? (
          <div className="grid gap-2">
            {leadIssue ? (
              <div className={`flex gap-3 rounded border p-3 text-sm ${getVolunteerIssueClass(leadIssue.severity)}`}>
                <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{leadIssue.message}</span>
              </div>
            ) : null}
            {message ? (
              <div className="rounded border border-line bg-background px-3 py-2 text-sm text-muted">{message}</div>
            ) : null}
          </div>
        ) : null}

        {items.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-background text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-3 font-semibold">序号</th>
                    <th className="px-3 py-3 font-semibold">档位</th>
                    <th className="px-3 py-3 font-semibold">院校专业组</th>
                    <th className="px-3 py-3 font-semibold">参考信息</th>
                    <th className="px-3 py-3 font-semibold">排序</th>
                    <th className="px-3 py-3 font-semibold">删除</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr className="border-t border-line bg-white align-top" key={getItemKey(item)}>
                      <td className="px-3 py-3 font-semibold text-muted">{index + 1}</td>
                      <td className="px-3 py-3">
                        <TierBadge tier={item.recommendation.tier} label={item.recommendation.tierLabel} />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{item.college.collegeName}</p>
                        <p className="mt-1 text-xs text-muted">
                          {item.key.collegeCode}-{item.key.groupCode} · {item.college.city ?? "城市待补"} ·{" "}
                          {item.eligibility.requirement}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs leading-5 text-muted">
                        <p>参考位次 {formatNumber(item.recommendation.referenceRank)}</p>
                        <p>计划 {formatNumber(item.eligibility.eligiblePlanCount)} 人</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <button
                            aria-label="上移"
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={index === 0}
                            title="上移"
                            type="button"
                            onClick={() => onMove(index, "up")}
                          >
                            <ArrowUp aria-hidden className="h-4 w-4" />
                          </button>
                          <button
                            aria-label="下移"
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={index === items.length - 1}
                            title="下移"
                            type="button"
                            onClick={() => onMove(index, "down")}
                          >
                            <ArrowDown aria-hidden className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          aria-label="删除志愿"
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-muted hover:border-danger hover:text-danger"
                          title="删除"
                          type="button"
                          onClick={() => onRemove(item)}
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {items.map((item, index) => (
                <article className="rounded border border-line bg-background p-3" key={getItemKey(item)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted">#{index + 1}</p>
                      <h3 className="mt-1 truncate text-sm font-semibold">{item.college.collegeName}</h3>
                      <p className="mt-1 text-xs text-muted">
                        {item.key.collegeCode}-{item.key.groupCode} · {item.eligibility.requirement}
                      </p>
                    </div>
                    <TierBadge tier={item.recommendation.tier} label={item.recommendation.tierLabel} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
                    <span>参考 {formatNumber(item.recommendation.referenceRank)}</span>
                    <span>计划 {formatNumber(item.eligibility.eligiblePlanCount)} 人</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      aria-label="上移"
                      className="inline-flex h-9 w-9 items-center justify-center rounded border border-line text-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={index === 0}
                      title="上移"
                      type="button"
                      onClick={() => onMove(index, "up")}
                    >
                      <ArrowUp aria-hidden className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="下移"
                      className="inline-flex h-9 w-9 items-center justify-center rounded border border-line text-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={index === items.length - 1}
                      title="下移"
                      type="button"
                      onClick={() => onMove(index, "down")}
                    >
                      <ArrowDown aria-hidden className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="删除志愿"
                      className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded border border-line text-muted hover:border-danger hover:text-danger"
                      title="删除"
                      type="button"
                      onClick={() => onRemove(item)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded border border-dashed border-line bg-background p-8 text-center text-sm text-muted">
            生成推荐后，从院校专业组列表加入志愿。
          </div>
        )}
      </div>
    </section>
  );
}

export function CandidateProfileWorkspace() {
  const [targetYear, setTargetYear] = useState(2025);
  const [firstChoiceSubject, setFirstChoiceSubject] = useState<FirstChoiceSubject>("physics");
  const [secondChoiceSubjects, setSecondChoiceSubjects] = useState<SecondChoiceSubject[]>([
    "chemistry",
    "biology",
  ]);
  const [score, setScore] = useState("550");
  const [rank, setRank] = useState("70000");
  const [riskPreference, setRiskPreference] = useState<RiskPreference>("balanced");
  const [requirePlan, setRequirePlan] = useState(true);
  const [includeHighRisk, setIncludeHighRisk] = useState(false);
  const [includeVerySafe, setIncludeVerySafe] = useState(true);
  const [tuitionLimit, setTuitionLimit] = useState("");
  const [preferredCities, setPreferredCities] = useState("合肥 南京");
  const [preferredMajorCategories, setPreferredMajorCategories] = useState("计算机 软件 数据");
  const [rejectedMajorCategories, setRejectedMajorCategories] = useState("护理 土木");
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [volunteerPlanItems, setVolunteerPlanItems] = useState<RecommendationItem[]>([]);
  const [volunteerPlanProfile, setVolunteerPlanProfile] = useState<RecommendationResult["profile"] | null>(null);
  const [volunteerPlanSavedAt, setVolunteerPlanSavedAt] = useState<string | null>(null);
  const [volunteerPlanMessage, setVolunteerPlanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const recommendationTopScrollRef = useRef<HTMLDivElement>(null);
  const recommendationTableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const rawDraft = window.localStorage.getItem(volunteerPlanStorageKey);
        if (!rawDraft) return;

        const draft: unknown = JSON.parse(rawDraft);
        if (!isStoredVolunteerPlanDraft(draft)) return;

        setVolunteerPlanItems(draft.items.slice(0, VOLUNTEER_PLAN_LIMIT));
        setVolunteerPlanProfile(draft.profile ?? null);
        setVolunteerPlanSavedAt(draft.savedAt);
      } catch {
        setVolunteerPlanMessage("已保存方案读取失败，可重新保存当前方案");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const selectedSecondChoiceLabels = useMemo(
    () =>
      secondChoiceOptions
        .filter((option) => secondChoiceSubjects.includes(option.value))
        .map((option) => option.label)
        .join(" + "),
    [secondChoiceSubjects],
  );

  const selectedItem = useMemo(() => {
    const items = [...(result?.items ?? []), ...volunteerPlanItems];
    if (!items.length) return null;

    return items.find((item) => getItemKey(item) === selectedKey) ?? result?.items[0] ?? volunteerPlanItems[0];
  }, [result, selectedKey, volunteerPlanItems]);

  const volunteerPlanKeySet = useMemo(
    () => new Set(volunteerPlanItems.map((item) => getItemKey(item))),
    [volunteerPlanItems],
  );

  const volunteerPlanAnalysis = useMemo(
    () => analyzeVolunteerPlan(volunteerPlanItems.map(toVolunteerPlanReference)),
    [volunteerPlanItems],
  );

  const tierCountTotal = useMemo(() => {
    if (!result) return 0;
    return tierOrder.reduce((sum, tier) => sum + result.filters.tierCounts[tier], 0);
  }, [result]);

  const addableRecommendationCount = useMemo(() => {
    if (!result) return 0;

    const references = volunteerPlanItems.map(toVolunteerPlanReference);
    let count = 0;

    for (const item of result.items) {
      const reference = toVolunteerPlanReference(item);
      const decision = canAddVolunteerPlanItem(references, reference);

      if (!decision.ok) continue;

      references.push(reference);
      count += 1;
    }

    return count;
  }, [result, volunteerPlanItems]);

  function toggleSecondChoice(subject: SecondChoiceSubject) {
    setSecondChoiceSubjects((current) => {
      if (current.includes(subject)) {
        return current.filter((item) => item !== subject);
      }

      if (current.length >= 2) {
        return [current[1], subject];
      }

      return [...current, subject];
    });
  }

  function markVolunteerPlanDirty() {
    setVolunteerPlanSavedAt(null);
  }

  function addToVolunteerPlan(item: RecommendationItem) {
    const decision = canAddVolunteerPlanItem(
      volunteerPlanItems.map(toVolunteerPlanReference),
      toVolunteerPlanReference(item),
    );

    if (!decision.ok) {
      setVolunteerPlanMessage(decision.reason);
      return;
    }

    setVolunteerPlanItems((current) => [...current, item]);
    setVolunteerPlanProfile(result?.profile ?? volunteerPlanProfile);
    setSelectedKey(getItemKey(item));
    setVolunteerPlanMessage(`${item.college.collegeName} 已加入志愿表`);
    markVolunteerPlanDirty();
  }

  function addVisibleRecommendationsToVolunteerPlan() {
    if (!result?.items.length) {
      setVolunteerPlanMessage("暂无可加入的推荐项");
      return;
    }

    const nextItems = [...volunteerPlanItems];
    const references = nextItems.map(toVolunteerPlanReference);
    let firstAddedKey: string | null = null;

    for (const item of result.items) {
      const reference = toVolunteerPlanReference(item);
      const decision = canAddVolunteerPlanItem(references, reference);

      if (!decision.ok) continue;

      nextItems.push(item);
      references.push(reference);
      firstAddedKey ??= getItemKey(item);
    }

    const addedCount = nextItems.length - volunteerPlanItems.length;

    if (!addedCount) {
      setVolunteerPlanMessage(volunteerPlanAnalysis.isFull ? "志愿表已满" : "当前推荐已全部加入志愿表");
      return;
    }

    setVolunteerPlanItems(nextItems);
    setVolunteerPlanProfile(result.profile);
    setSelectedKey(firstAddedKey);
    setVolunteerPlanMessage(`已加入 ${addedCount} 个推荐项`);
    markVolunteerPlanDirty();
  }

  function syncRecommendationTableScroll(source: "top" | "table") {
    const top = recommendationTopScrollRef.current;
    const table = recommendationTableScrollRef.current;

    if (!top || !table) return;

    if (source === "top") {
      table.scrollLeft = top.scrollLeft;
    } else {
      top.scrollLeft = table.scrollLeft;
    }
  }

  function removeFromVolunteerPlan(item: RecommendationItem) {
    setVolunteerPlanItems((current) => current.filter((currentItem) => getItemKey(currentItem) !== getItemKey(item)));
    setVolunteerPlanMessage(`${item.college.collegeName} 已从志愿表删除`);
    markVolunteerPlanDirty();
  }

  function moveVolunteerPlan(index: number, direction: "up" | "down") {
    setVolunteerPlanItems((current) => moveVolunteerPlanItem(current, index, direction));
    setVolunteerPlanMessage("志愿顺序已更新");
    markVolunteerPlanDirty();
  }

  function saveVolunteerPlan() {
    if (!volunteerPlanItems.length) {
      setVolunteerPlanMessage("志愿表为空，暂不保存");
      return;
    }

    const savedAt = new Date().toISOString();
    const draft: StoredVolunteerPlanDraft = {
      version: 1,
      savedAt,
      profile: volunteerPlanProfile ?? result?.profile ?? null,
      items: volunteerPlanItems,
    };

    try {
      window.localStorage.setItem(volunteerPlanStorageKey, JSON.stringify(draft));
      setVolunteerPlanSavedAt(savedAt);
      setVolunteerPlanProfile(draft.profile);
      setVolunteerPlanMessage("方案已保存到本机浏览器");
    } catch {
      setVolunteerPlanMessage("方案保存失败，请减少条目后重试");
    }
  }

  function clearVolunteerPlan() {
    setVolunteerPlanItems([]);
    setVolunteerPlanProfile(null);
    setVolunteerPlanSavedAt(null);
    setVolunteerPlanMessage("志愿表已清空");
    window.localStorage.removeItem(volunteerPlanStorageKey);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const parsedTuitionLimit = tuitionLimit.trim() ? Number(tuitionLimit) : undefined;

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirePlan,
          includeHighRisk,
          includeVerySafe,
          limit: 45,
          offset: 0,
          profile: {
            targetYear,
            provinceCode: "AH",
            batchCode: "ordinary_undergraduate",
            firstChoiceSubject,
            secondChoiceSubjects,
            score: Number(score),
            rank: Number(rank),
            riskPreference,
            tuitionLimit: parsedTuitionLimit,
            preferredCities: splitTextInput(preferredCities),
            preferredMajorCategories: splitTextInput(preferredMajorCategories),
            rejectedMajorCategories: splitTextInput(rejectedMajorCategories),
          },
        }),
      });
      const data = await response.json();

      if (response.status === 422 && data.result) {
        setResult(data.result);
        setSelectedKey(data.result.items[0] ? getItemKey(data.result.items[0]) : null);
        return;
      }

      if (!response.ok) {
        setError(data.message ?? data.error ?? "推荐生成失败");
        return;
      }

      setResult(data);
      setSelectedKey(data.items[0] ? getItemKey(data.items[0]) : null);
    } catch {
      setError("无法连接推荐接口");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-8">
        <section className="rounded-lg border border-line bg-panel p-5 shadow-sm lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:self-start lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">第 7 周</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal">推荐与志愿表工作台</h1>
              <p className="mt-2 text-sm leading-6 text-muted">安徽普通类本科批 · 院校专业组方案</p>
            </div>
            <ShieldCheck aria-hidden className="h-6 w-6 text-accent" />
          </div>

          <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-medium">
              数据年份
              <select
                className="h-11 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                value={targetYear}
                onChange={(event) => setTargetYear(Number(event.target.value))}
              >
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
            </label>

            <div className="grid gap-2">
              <span className="text-sm font-medium">首选科目</span>
              <div className="grid grid-cols-2 gap-2">
                {firstChoiceOptions.map((option) => (
                  <button
                    className={`flex h-11 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold ${
                      firstChoiceSubject === option.value
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-white text-foreground hover:border-accent"
                    }`}
                    key={option.value}
                    type="button"
                    onClick={() => setFirstChoiceSubject(option.value)}
                  >
                    <GraduationCap aria-hidden className="h-4 w-4" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">再选科目</span>
              <div className="grid grid-cols-2 gap-2">
                {secondChoiceOptions.map((option) => {
                  const selected = secondChoiceSubjects.includes(option.value);

                  return (
                    <button
                      className={`h-10 rounded border px-3 text-sm font-semibold ${
                        selected
                          ? "border-accent bg-accent-soft text-accent-strong"
                          : "border-line bg-white text-foreground hover:border-accent"
                      }`}
                      key={option.value}
                      type="button"
                      onClick={() => toggleSecondChoice(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted">{selectedSecondChoiceLabels || "未选择"}</p>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-3">
              <label className="grid min-w-0 gap-2 text-sm font-medium">
                分数
                <input
                  className="h-11 w-full min-w-0 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                  inputMode="numeric"
                  max={750}
                  min={0}
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium">
                位次
                <input
                  className="h-11 w-full min-w-0 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                  inputMode="numeric"
                  min={1}
                  value={rank}
                  onChange={(event) => setRank(event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">风险偏好</span>
              <div className="grid grid-cols-3 gap-2">
                {riskOptions.map((option) => (
                  <button
                    className={`h-10 rounded border px-2 text-sm font-semibold ${
                      riskPreference === option.value
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-white text-foreground hover:border-accent"
                    }`}
                    key={option.value}
                    type="button"
                    onClick={() => setRiskPreference(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-medium">
                城市偏好
                <input
                  className="h-11 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                  placeholder="例如：合肥 南京"
                  value={preferredCities}
                  onChange={(event) => setPreferredCities(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                专业偏好
                <input
                  className="h-11 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                  placeholder="例如：计算机 软件"
                  value={preferredMajorCategories}
                  onChange={(event) => setPreferredMajorCategories(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                排斥方向
                <input
                  className="h-11 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                  placeholder="例如：护理 土木"
                  value={rejectedMajorCategories}
                  onChange={(event) => setRejectedMajorCategories(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                学费上限
                <input
                  className="h-11 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                  inputMode="numeric"
                  placeholder="可留空"
                  value={tuitionLimit}
                  onChange={(event) => setTuitionLimit(event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-2">
              <label className="flex items-center justify-between gap-4 rounded border border-line bg-background px-3 py-3 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Filter aria-hidden className="h-4 w-4 text-accent" />
                  仅有计划明细
                </span>
                <input
                  checked={requirePlan}
                  className="h-5 w-5 accent-[var(--accent)]"
                  type="checkbox"
                  onChange={(event) => setRequirePlan(event.target.checked)}
                />
              </label>
              <p className="text-xs leading-5 text-muted">
                默认只使用有当年计划明细的专业组；关闭后仅用于排查 OCR 历史样例。
              </p>
              <label className="flex items-center justify-between gap-4 rounded border border-line bg-background px-3 py-3 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <ShieldAlert aria-hidden className="h-4 w-4 text-warning" />
                  高危冲刺
                </span>
                <input
                  checked={includeHighRisk}
                  className="h-5 w-5 accent-[var(--accent)]"
                  type="checkbox"
                  onChange={(event) => setIncludeHighRisk(event.target.checked)}
                />
              </label>
              <p className="text-xs leading-5 text-muted">
                默认不纳入高危项；打开后会预留少量冲高志愿。
              </p>
              <label className="flex items-center justify-between gap-4 rounded border border-line bg-background px-3 py-3 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <ShieldCheck aria-hidden className="h-4 w-4 text-success" />
                  过保兜底
                </span>
                <input
                  checked={includeVerySafe}
                  className="h-5 w-5 accent-[var(--accent)]"
                  type="checkbox"
                  onChange={(event) => setIncludeVerySafe(event.target.checked)}
                />
              </label>
              <p className="text-xs leading-5 text-muted">
                打开时保留少量兜底项；关闭后优先用保档补足名额。
              </p>
            </div>

            <button
              className="flex h-12 items-center justify-center gap-2 rounded bg-foreground px-4 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending || secondChoiceSubjects.length !== 2}
              type="submit"
            >
              {isPending ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Search aria-hidden className="h-4 w-4" />
              )}
              生成推荐结果
            </button>
          </form>

          <div className="mt-5 flex gap-3 rounded border border-line bg-background p-3 text-sm leading-6 text-muted">
            <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p>推荐结果只做概率参考，不能作为录取承诺。</p>
          </div>
        </section>

        <section className="grid gap-5">
          <div className="rounded-lg border border-line bg-panel p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-accent">第 7 周工作台</p>
                <h2 className="mt-2 text-2xl font-semibold">生成推荐并整理志愿表</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  展示院校专业组分档、参考位次、风险标签和推荐理由；推荐项可加入志愿表，并在表内删除、排序、保存。
                </p>
              </div>
              {result ? (
                <div className="rounded border border-line bg-background px-3 py-2 text-sm text-muted">
                  {result.algorithm.version} · {result.algorithm.dataVersion}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricBlock
              icon={<Database aria-hidden className="h-5 w-5" />}
              label="可推荐项"
              value={result?.filters.recommendableCount ?? "--"}
            />
            <MetricBlock
              icon={<BadgeCheck aria-hidden className="h-5 w-5" />}
              label="选科通过"
              value={result?.filters.subjectMatchedCount ?? "--"}
            />
            <MetricBlock
              icon={<ShieldAlert aria-hidden className="h-5 w-5" />}
              label="低置信度"
              value={result?.filters.lowConfidenceCount ?? "--"}
            />
            <MetricBlock
              icon={<BarChart3 aria-hidden className="h-5 w-5" />}
              label="推荐分档"
              value={result ? tierCountTotal : "--"}
            />
          </div>

          {result ? (
            <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {tierOrder.map((tier) => (
                  <span className={`rounded border px-3 py-1 text-sm font-semibold ${getTierClass(tier)}`} key={tier}>
                    {tierLabels[tier]} {result.filters.tierCounts[tier]}
                  </span>
                ))}
                <span className="rounded border border-line bg-background px-3 py-1 text-sm text-muted">
                  参考年份 {result.algorithm.referenceYears.join("、")}
                </span>
              </div>
            </div>
          ) : null}

          <VolunteerPlanEditor
            analysis={volunteerPlanAnalysis}
            items={volunteerPlanItems}
            message={volunteerPlanMessage}
            profile={volunteerPlanProfile ?? result?.profile ?? null}
            savedAt={volunteerPlanSavedAt}
            onClear={clearVolunteerPlan}
            onMove={moveVolunteerPlan}
            onRemove={removeFromVolunteerPlan}
            onSave={saveVolunteerPlan}
          />

          {error ? (
            <div className="flex items-center gap-3 rounded border border-danger bg-danger-soft p-4 text-sm text-danger">
              <XCircle aria-hidden className="h-5 w-5 shrink-0" />
              {error}
            </div>
          ) : null}

          {result?.scoreRankCheck.issues.length ? (
            <div className="grid gap-2">
              {result.scoreRankCheck.issues.map((issue) => (
                <div
                  className="flex gap-3 rounded border border-danger bg-danger-soft p-4 text-sm leading-6 text-danger"
                  key={issue.code}
                >
                  <XCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          ) : null}

          {result?.scoreRankCheck.segment ? (
            <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal aria-hidden className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold">分数位次校验</h2>
                </div>
                <span className="text-sm font-semibold text-accent">已匹配一分一段</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted">同分人数</p>
                  <p className="mt-1 font-semibold">{formatNumber(result.scoreRankCheck.segment.count)}</p>
                </div>
                <div>
                  <p className="text-muted">累计人数</p>
                  <p className="mt-1 font-semibold">
                    {formatNumber(result.scoreRankCheck.segment.cumulativeCount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">位次区间</p>
                  <p className="mt-1 font-semibold">
                    {formatNumber(result.scoreRankCheck.segment.rankMin)}-
                    {formatNumber(result.scoreRankCheck.segment.rankMax)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">科类</p>
                  <p className="mt-1 font-semibold">{getSubjectTrackLabel(firstChoiceSubject)}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="rounded-lg border border-line bg-panel shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Table2 aria-hidden className="h-5 w-5 text-accent" />
                    <h2 className="text-lg font-semibold">推荐院校专业组</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {result
                      ? `${getSubjectTrackLabel(result.profile.firstChoiceSubject)} · ${getRiskPreferenceLabel(
                          result.profile.riskPreference,
                        )}策略 · 返回 ${result.items.length} 条`
                      : "提交建档信息后显示推荐表格和卡片。"}
                  </p>
                </div>
                {result ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-line bg-background px-3 py-1 text-sm text-muted">
                      排除选科不符 {result.filters.subjectMismatchCount} 个
                    </span>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded border border-line bg-white px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={addableRecommendationCount === 0}
                      title={addableRecommendationCount ? "将当前推荐加入志愿表" : "当前推荐已全部加入志愿表"}
                      type="button"
                      onClick={addVisibleRecommendationsToVolunteerPlan}
                    >
                      {addableRecommendationCount ? (
                        <Plus aria-hidden className="h-4 w-4" />
                      ) : (
                        <Check aria-hidden className="h-4 w-4" />
                      )}
                      {addableRecommendationCount ? `一键添加 ${addableRecommendationCount}` : "已全部加入"}
                    </button>
                  </div>
                ) : null}
              </div>

              {result?.items.length ? (
                <>
                  <div
                    aria-hidden
                    className="hidden overflow-x-auto border-b border-line bg-background/70 lg:block"
                    ref={recommendationTopScrollRef}
                    onScroll={() => syncRecommendationTableScroll("top")}
                  >
                    <div className="h-3 min-w-[980px]" />
                  </div>
                  <div
                    className="hidden overflow-x-auto lg:block"
                    ref={recommendationTableScrollRef}
                    onScroll={() => syncRecommendationTableScroll("table")}
                  >
                    <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                      <thead className="bg-background text-xs uppercase text-muted">
                        <tr>
                          <th className="px-4 py-3 font-semibold">档位</th>
                          <th className="px-4 py-3 font-semibold">院校专业组</th>
                          <th className="px-4 py-3 font-semibold">位次模型</th>
                          <th className="px-4 py-3 font-semibold">计划与历史</th>
                          <th className="px-4 py-3 font-semibold">风险标签</th>
                          <th className="px-4 py-3 font-semibold">推荐理由</th>
                          <th className="px-4 py-3 font-semibold">加入</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.items.map((item) => {
                          const selected = selectedItem ? getItemKey(item) === getItemKey(selectedItem) : false;
                          const itemInVolunteerPlan = volunteerPlanKeySet.has(getItemKey(item));

                          return (
                            <tr
                              className={`cursor-pointer border-t border-line align-top transition ${
                                selected ? "bg-accent-soft/60" : "bg-white hover:bg-background"
                              }`}
                              key={getItemKey(item)}
                              tabIndex={0}
                              onClick={() => setSelectedKey(getItemKey(item))}
                              onKeyDown={(event) =>
                                handleKeyboardSelect(event, () => setSelectedKey(getItemKey(item)))
                              }
                            >
                              <td className="px-4 py-4">
                                <TierBadge tier={item.recommendation.tier} label={item.recommendation.tierLabel} />
                                <p className="mt-2 max-w-24 text-xs leading-5 text-muted">
                                  {item.recommendation.tier
                                    ? tierDescriptions[item.recommendation.tier]
                                    : "数据待确认"}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="font-semibold">{item.college.collegeName}</p>
                                <p className="mt-1 text-xs text-muted">
                                  {item.key.collegeCode}-{item.key.groupCode} · {item.college.city ?? "城市待补"}
                                </p>
                                <p className="mt-2 inline-flex items-center gap-1 rounded border border-line bg-background px-2 py-1 text-xs text-muted">
                                  <GraduationCap aria-hidden className="h-3.5 w-3.5" />
                                  {item.eligibility.requirement}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="font-semibold">参考 {formatNumber(item.recommendation.referenceRank)}</p>
                                <p className="mt-1 text-xs text-muted">
                                  位次差 {formatSignedPercent(item.recommendation.rankGapRatio)}
                                </p>
                                <p className="mt-1 text-xs text-muted">
                                  综合分 {item.recommendation.recommendationScore} · 偏好分{" "}
                                  {item.recommendation.preferenceScore}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="font-semibold">
                                  {item.eligibility.eligibleMajorPlanCount} 个专业 /{" "}
                                  {formatNumber(item.eligibility.eligiblePlanCount)} 人
                                </p>
                                <p className="mt-1 max-w-48 text-xs leading-5 text-muted">
                                  近三年位次 {formatCompactHistoricalRanks(item)}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex max-w-44 flex-wrap gap-1.5">
                                  {getRiskPills(item).slice(0, 4).map((pill) => (
                                    <RiskPill key={pill.label} label={pill.label} tone={pill.tone} />
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <p className="max-w-64 leading-6 text-muted">
                                  {item.recommendation.explanations[0] ?? "暂无推荐理由"}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  aria-label={itemInVolunteerPlan ? "已加入志愿表" : "加入志愿表"}
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded border transition disabled:cursor-not-allowed ${
                                    itemInVolunteerPlan
                                      ? "border-success bg-success-soft text-success disabled:opacity-80"
                                      : "border-line bg-white text-foreground hover:border-accent hover:text-accent disabled:opacity-50"
                                  }`}
                                  disabled={itemInVolunteerPlan || (!itemInVolunteerPlan && volunteerPlanAnalysis.isFull)}
                                  title={itemInVolunteerPlan ? "已加入志愿表" : "加入志愿表"}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    addToVolunteerPlan(item);
                                  }}
                                >
                                  {itemInVolunteerPlan ? (
                                    <Check aria-hidden className="h-4 w-4" />
                                  ) : (
                                    <Plus aria-hidden className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-3 p-4 lg:hidden">
                    {result.items.map((item) => (
                      <RecommendationCard
                        inVolunteerPlan={volunteerPlanKeySet.has(getItemKey(item))}
                        item={item}
                        key={getItemKey(item)}
                        planFull={volunteerPlanAnalysis.isFull}
                        selected={selectedItem ? getItemKey(item) === getItemKey(selectedItem) : false}
                        onAdd={() => addToVolunteerPlan(item)}
                        onSelect={() => setSelectedKey(getItemKey(item))}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-4">
                  <div className="rounded border border-dashed border-line bg-background p-8 text-center text-sm text-muted">
                    {result ? "没有符合当前规则的推荐项。" : "提交建档信息后显示推荐结果。"}
                  </div>
                </div>
              )}
            </div>

            <RecommendationDetailPanel
              inVolunteerPlan={selectedItem ? volunteerPlanKeySet.has(getItemKey(selectedItem)) : false}
              item={selectedItem}
              planFull={volunteerPlanAnalysis.isFull}
              profile={result?.profile ?? null}
              onAdd={selectedItem ? () => addToVolunteerPlan(selectedItem) : undefined}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-panel p-4 text-sm leading-6 text-muted shadow-sm">
              <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                <MapPin aria-hidden className="h-4 w-4 text-accent" />
                城市与专业偏好
              </div>
              偏好命中会影响排序，但不会绕过选科和批次硬规则。
            </div>
            <div className="rounded-lg border border-line bg-panel p-4 text-sm leading-6 text-muted shadow-sm">
              <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                <WalletCards aria-hidden className="h-4 w-4 text-warning" />
                学费与计划风险
              </div>
              学费预算、计划缺失和样例数据会以标签形式暴露。
            </div>
            <div className="rounded-lg border border-line bg-panel p-4 text-sm leading-6 text-muted shadow-sm">
              <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                <Landmark aria-hidden className="h-4 w-4 text-info" />
                专业组详情入口
              </div>
              表格和详情面板都可以进入专业组数据详情。
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
