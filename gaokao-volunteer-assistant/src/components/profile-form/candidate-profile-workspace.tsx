"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  Database,
  Filter,
  GraduationCap,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type FirstChoiceSubject = "physics" | "history";
type SecondChoiceSubject = "chemistry" | "biology" | "politics" | "geography";
type RiskPreference = "conservative" | "balanced" | "aggressive";

type CandidateResult = {
  scoreRankCheck: {
    valid: boolean;
    issues: Array<{ code: string; message: string; severity: "error" | "warning" }>;
    segment: {
      score: number;
      count: number;
      cumulativeCount: number;
      rankMin: number | null;
      rankMax: number | null;
      source: {
        title: string;
        sourceUrl: string;
        reviewStatus: string;
      };
    } | null;
  };
  filters: {
    batchCount: number;
    subjectTrackCount: number;
    subjectMatchedCount: number;
    subjectMismatchCount: number;
    noEligiblePlanCount: number;
    requirePlan: boolean;
  };
  total: number;
  limit: number;
  offset: number;
  items: CandidateItem[];
};

type CandidateItem = {
  key: {
    year: number;
    subjectTrack: FirstChoiceSubject;
    collegeCode: string;
    groupCode: string;
  };
  college: {
    collegeName: string;
    province: string | null;
    city: string | null;
    level: string | null;
    ownership: string | null;
  };
  subjectRequirement: string;
  groupNote: string | null;
  majorPlans: Array<{
    majorCode: string;
    majorName: string;
    planCount: number;
    tuition: number | null;
    subjectRequirement: string | null;
  }>;
  source: {
    title: string;
    reviewStatus: string;
  };
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

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("zh-CN") : "暂无";
}

function getSubjectTrackLabel(value: FirstChoiceSubject) {
  return value === "physics" ? "物理类" : "历史类";
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
  const [requirePlan, setRequirePlan] = useState(false);
  const [result, setResult] = useState<CandidateResult | null>(null);
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

    try {
      const response = await fetch("/api/candidate-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirePlan,
          limit: 30,
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
            preferredCities: [],
            preferredMajorCategories: [],
            rejectedMajorCategories: [],
          },
        }),
      });
      const data = await response.json();

      if (response.status === 422 && data.result) {
        setResult(data.result);
        return;
      }

      if (!response.ok) {
        setError(data.message ?? data.error ?? "候选集生成失败");
        return;
      }

      setResult(data);
    } catch {
      setError("无法连接候选集接口");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <section className="border border-line bg-panel p-5 shadow-sm lg:sticky lg:top-5 lg:self-start">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">第 4 周</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal">考生建档与候选过滤</h1>
            </div>
            <ShieldCheck aria-hidden className="h-6 w-6 text-accent" />
          </div>

          <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-medium">
              数据年份
              <select
                className="h-11 border border-line bg-white px-3 text-sm outline-none focus:border-accent"
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
                    className={`flex h-11 items-center justify-center gap-2 border px-3 text-sm font-semibold ${
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
                      className={`h-10 border px-3 text-sm font-semibold ${
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
                  className="h-11 w-full min-w-0 border border-line bg-white px-3 text-sm outline-none focus:border-accent"
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
                  className="h-11 w-full min-w-0 border border-line bg-white px-3 text-sm outline-none focus:border-accent"
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
                    className={`h-10 border px-2 text-sm font-semibold ${
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

            <label className="flex items-center justify-between gap-4 border border-line bg-background px-3 py-3 text-sm font-medium">
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

            <button
              className="flex h-12 items-center justify-center gap-2 bg-foreground px-4 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending || secondChoiceSubjects.length !== 2}
              type="submit"
            >
              {isPending ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Search aria-hidden className="h-4 w-4" />
              )}
              生成候选集
            </button>
          </form>

          <div className="mt-5 flex gap-3 border border-line bg-background p-3 text-sm leading-6 text-muted">
            <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p>当前输出是规则候选集，不生成录取承诺。</p>
          </div>
        </section>

        <section className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border border-line bg-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted">批次范围</span>
                <Database aria-hidden className="h-5 w-5 text-accent" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{result?.filters.batchCount ?? "--"}</p>
            </div>
            <div className="border border-line bg-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted">选科通过</span>
                <BadgeCheck aria-hidden className="h-5 w-5 text-accent" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{result?.filters.subjectMatchedCount ?? "--"}</p>
            </div>
            <div className="border border-line bg-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted">返回候选</span>
                <BookOpenCheck aria-hidden className="h-5 w-5 text-accent" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{result?.total ?? "--"}</p>
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-3 border border-danger bg-danger-soft p-4 text-sm text-danger">
              <XCircle aria-hidden className="h-5 w-5 shrink-0" />
              {error}
            </div>
          ) : null}

          {result?.scoreRankCheck.issues.length ? (
            <div className="grid gap-2">
              {result.scoreRankCheck.issues.map((issue) => (
                <div
                  className="flex gap-3 border border-danger bg-danger-soft p-4 text-sm leading-6 text-danger"
                  key={issue.code}
                >
                  <XCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          ) : null}

          {result?.scoreRankCheck.segment ? (
            <div className="border border-line bg-panel p-4">
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

          <div className="border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">候选院校专业组</h2>
                <p className="mt-1 text-sm text-muted">
                  已按安徽普通本科批、{getSubjectTrackLabel(firstChoiceSubject)}、选科要求过滤
                </p>
              </div>
              {result ? (
                <span className="text-sm text-muted">
                  排除选科不符 {result.filters.subjectMismatchCount} 个
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              {result?.items.length ? (
                result.items.map((item) => (
                  <article className="border border-line bg-white p-4" key={`${item.key.collegeCode}-${item.key.groupCode}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{item.college.collegeName}</h3>
                          <span className="border border-line bg-background px-2 py-1 text-xs font-semibold text-muted">
                            {item.key.collegeCode}-{item.key.groupCode}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted">
                          {item.college.province ?? "省份待补"} {item.college.city ?? ""} ·{" "}
                          {item.college.level ?? "层次待补"} · 要求 {item.eligibility.requirement}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-semibold ${
                          item.eligibility.hasEligibleMajorPlan
                            ? "bg-accent-soft text-accent-strong"
                            : "bg-warning-soft text-warning"
                        }`}
                      >
                        {item.eligibility.hasEligibleMajorPlan ? "有计划" : "计划待补"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-muted">招生计划</p>
                        <p className="mt-1 font-semibold">
                          {item.eligibility.eligibleMajorPlanCount} 个专业 /{" "}
                          {formatNumber(item.eligibility.eligiblePlanCount)} 人
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">历史最低分</p>
                        <p className="mt-1 font-semibold">
                          {formatNumber(item.eligibility.latestAdmission?.minScore)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">历史最低位次</p>
                        <p className="mt-1 font-semibold">
                          {formatNumber(item.eligibility.latestAdmission?.minRank)}
                        </p>
                      </div>
                    </div>

                    {item.majorPlans.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.majorPlans.slice(0, 5).map((plan) => (
                          <span
                            className="border border-line bg-background px-2 py-1 text-xs text-muted"
                            key={plan.majorCode}
                          >
                            {plan.majorName} · {plan.planCount} 人
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="border border-dashed border-line bg-background p-8 text-center text-sm text-muted">
                  {result ? "没有符合当前规则的院校专业组。" : "提交建档信息后显示候选集。"}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
