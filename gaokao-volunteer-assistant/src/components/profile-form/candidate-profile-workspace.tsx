"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  CircleAlert,
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
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

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
    historicalRanks: Array<{ year: number; minRank: number }>;
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

const tierOrder: RecommendationTier[] = ["reach", "match", "safe", "very_safe", "high_risk"];
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

function RecommendationCard({
  item,
  selected,
  onSelect,
}: {
  item: RecommendationItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`rounded-lg border bg-white p-4 shadow-sm ${selected ? "border-accent" : "border-line"}`}>
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
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded border border-line px-3 text-xs font-semibold text-foreground hover:border-accent hover:text-accent"
          type="button"
          onClick={onSelect}
        >
          详情
          <ChevronRight aria-hidden className="h-4 w-4" />
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
}: {
  item: RecommendationItem | null;
  profile: RecommendationResult["profile"] | null;
}) {
  if (!item) {
    return (
      <aside className="rounded-lg border border-dashed border-line bg-panel p-6 text-sm text-muted xl:sticky xl:top-5 xl:self-start">
        <Info aria-hidden className="mb-3 h-5 w-5 text-accent" />
        选择一条推荐后查看院校专业组详情、风险标签和推荐理由。
      </aside>
    );
  }

  const riskPills = getRiskPills(item);
  const detailHref = getDetailHref(item);

  return (
    <aside className="rounded-lg border border-line bg-panel p-5 shadow-sm xl:sticky xl:top-5 xl:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <TierBadge tier={item.recommendation.tier} label={item.recommendation.tierLabel} />
          <h3 className="mt-3 text-lg font-semibold">{item.college.collegeName}</h3>
          <p className="mt-1 text-sm text-muted">
            {item.key.collegeCode}-{item.key.groupCode} · {item.college.province ?? "省份待补"}
            {item.college.city ? ` ${item.college.city}` : ""}
          </p>
        </div>
        <a
          aria-label="打开院校专业组数据"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line text-muted hover:border-accent hover:text-accent"
          href={detailHref}
          rel="noreferrer"
          target="_blank"
          title="打开院校专业组数据"
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
        </a>
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
          历史位次
        </div>
        <div className="mt-3 grid gap-2">
          {item.recommendation.historicalRanks.length ? (
            item.recommendation.historicalRanks.map((rank) => (
              <div
                className="flex items-center justify-between rounded border border-line bg-background px-3 py-2 text-sm"
                key={rank.year}
              >
                <span className="text-muted">{rank.year}</span>
                <span className="font-semibold">{formatNumber(rank.minRank)}</span>
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
  const [tuitionLimit, setTuitionLimit] = useState("");
  const [preferredCities, setPreferredCities] = useState("合肥 南京");
  const [preferredMajorCategories, setPreferredMajorCategories] = useState("计算机 软件 数据");
  const [rejectedMajorCategories, setRejectedMajorCategories] = useState("护理 土木");
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const selectedSecondChoiceLabels = useMemo(
    () =>
      secondChoiceOptions
        .filter((option) => secondChoiceSubjects.includes(option.value))
        .map((option) => option.label)
        .join(" + "),
    [secondChoiceSubjects],
  );

  const selectedItem = useMemo(() => {
    if (!result?.items.length) return null;
    return result.items.find((item) => getItemKey(item) === selectedKey) ?? result.items[0];
  }, [result, selectedKey]);

  const tierCountTotal = useMemo(() => {
    if (!result) return 0;
    return tierOrder.reduce((sum, tier) => sum + result.filters.tierCounts[tier], 0);
  }, [result]);

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
        <section className="rounded-lg border border-line bg-panel p-5 shadow-sm lg:sticky lg:top-5 lg:self-start">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">第 6 周</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal">推荐结果解释工作台</h1>
              <p className="mt-2 text-sm leading-6 text-muted">安徽普通类本科批 · 院校专业组推荐</p>
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
                  显示高危项
                </span>
                <input
                  checked={includeHighRisk}
                  className="h-5 w-5 accent-[var(--accent)]"
                  type="checkbox"
                  onChange={(event) => setIncludeHighRisk(event.target.checked)}
                />
              </label>
              <p className="text-xs leading-5 text-muted">
                默认隐藏位次差距过大的高危项；打开后仅用于风险排查。
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
                <p className="text-sm font-semibold text-accent">推荐结果页</p>
                <h2 className="mt-2 text-2xl font-semibold">用户能看懂的冲稳保推荐</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  展示院校专业组分档、参考位次、风险标签、推荐理由和详情入口；桌面端用表格快速比较，手机端用卡片逐条阅读。
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
                  <span className="rounded border border-line bg-background px-3 py-1 text-sm text-muted">
                    排除选科不符 {result.filters.subjectMismatchCount} 个
                  </span>
                ) : null}
              </div>

              {result?.items.length ? (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                      <thead className="bg-background text-xs uppercase text-muted">
                        <tr>
                          <th className="px-4 py-3 font-semibold">档位</th>
                          <th className="px-4 py-3 font-semibold">院校专业组</th>
                          <th className="px-4 py-3 font-semibold">位次模型</th>
                          <th className="px-4 py-3 font-semibold">计划与历史</th>
                          <th className="px-4 py-3 font-semibold">风险标签</th>
                          <th className="px-4 py-3 font-semibold">推荐理由</th>
                          <th className="px-4 py-3 font-semibold">详情</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.items.map((item) => {
                          const selected = selectedItem ? getItemKey(item) === getItemKey(selectedItem) : false;

                          return (
                            <tr
                              className={`border-t border-line align-top ${
                                selected ? "bg-accent-soft/60" : "bg-white hover:bg-background"
                              }`}
                              key={getItemKey(item)}
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
                                <p className="mt-1 text-xs text-muted">
                                  近年最低位次{" "}
                                  {formatNumber(item.eligibility.latestAdmission?.minRank)}
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
                                  className="inline-flex h-9 items-center gap-1 rounded border border-line px-3 text-xs font-semibold hover:border-accent hover:text-accent"
                                  type="button"
                                  onClick={() => setSelectedKey(getItemKey(item))}
                                >
                                  查看
                                  <ChevronRight aria-hidden className="h-4 w-4" />
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
                        item={item}
                        key={getItemKey(item)}
                        selected={selectedItem ? getItemKey(item) === getItemKey(selectedItem) : false}
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

            <RecommendationDetailPanel item={selectedItem} profile={result?.profile ?? null} />
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
