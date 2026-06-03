"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Database,
  Download,
  FileText,
  ListChecks,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildVolunteerRiskReport,
  type VolunteerRiskReportItem,
  type VolunteerRiskReportSeverity,
  type VolunteerRiskReportStatus,
  type VolunteerRiskReportTier,
} from "@/lib/volunteer-risk-report";
import {
  isStoredVolunteerPlanDraft,
  volunteerPlanStorageKey,
  type StoredVolunteerPlanDraft,
} from "@/lib/volunteer-plan-storage";
import {
  downloadVolunteerReportPdf,
  type VolunteerReportPdfPlanItem,
} from "@/lib/volunteer-report-export";

type StoredReportProfile = {
  targetYear: number;
  firstChoiceSubject: "physics" | "history";
  score: number;
  rank: number;
  riskPreference: "conservative" | "balanced" | "aggressive";
};

type StoredReportAlgorithm = {
  version: string;
  dataVersion: string;
  referenceYears: number[];
};

type StoredReportItem = {
  key: {
    year?: number;
    subjectTrack?: "physics" | "history";
    collegeCode: string;
    groupCode: string;
  };
  college: {
    collegeName: string;
    city?: string | null;
  };
  recommendation: {
    tier: VolunteerRiskReportTier | null;
    tierLabel: string;
    referenceRank: number | null;
    rankGapRatio: number | null;
    lowConfidence: boolean;
    confidenceReasons: string[];
    preferencePenalties: string[];
  };
  majorPlans: Array<{
    majorName: string;
    tuition: number | null;
    note: string | null;
  }>;
  eligibility: {
    eligiblePlanCount: number;
  };
};

type ReportDraft = StoredVolunteerPlanDraft<StoredReportItem, StoredReportProfile, StoredReportAlgorithm>;

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("zh-CN") : "暂无";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "暂无";

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSubjectTrackLabel(value: StoredReportProfile["firstChoiceSubject"] | undefined) {
  return value === "history" ? "历史类" : "物理类";
}

function getStatusClass(status: VolunteerRiskReportStatus) {
  switch (status) {
    case "ready":
      return "border-success bg-success-soft text-success";
    case "needs_attention":
      return "border-warning bg-warning-soft text-warning";
    case "high_risk":
      return "border-danger bg-danger-soft text-danger";
    default:
      return "border-line bg-background text-muted";
  }
}

function getSeverityClass(severity: VolunteerRiskReportSeverity) {
  switch (severity) {
    case "danger":
      return "border-danger bg-danger-soft text-danger";
    case "warning":
      return "border-warning bg-warning-soft text-warning";
    default:
      return "border-info bg-info-soft text-info";
  }
}

function toReportItem(item: StoredReportItem): VolunteerRiskReportItem {
  return {
    planKey: `${item.key.year ?? "saved"}-${item.key.subjectTrack ?? "track"}-${item.key.collegeCode}-${item.key.groupCode}`,
    collegeName: item.college.collegeName,
    collegeCode: item.key.collegeCode,
    groupCode: item.key.groupCode,
    tier: item.recommendation.tier,
    tierLabel: item.recommendation.tierLabel,
    referenceRank: item.recommendation.referenceRank,
    rankGapRatio: item.recommendation.rankGapRatio,
    lowConfidence: item.recommendation.lowConfidence,
    confidenceReasons: item.recommendation.confidenceReasons,
    preferencePenalties: item.recommendation.preferencePenalties,
    eligiblePlanCount: item.eligibility.eligiblePlanCount,
    majorPlans: item.majorPlans.map((plan) => ({
      majorName: plan.majorName,
      tuition: plan.tuition,
      note: plan.note,
    })),
  };
}

function toPdfPlanItem(item: StoredReportItem, index: number): VolunteerReportPdfPlanItem {
  return {
    planKey: `${item.key.year ?? "saved"}-${item.key.subjectTrack ?? "track"}-${item.key.collegeCode}-${item.key.groupCode}`,
    order: index + 1,
    collegeName: item.college.collegeName,
    collegeCode: item.key.collegeCode,
    groupCode: item.key.groupCode,
    city: item.college.city,
    tier: item.recommendation.tier,
    tierLabel: item.recommendation.tierLabel,
    referenceRank: item.recommendation.referenceRank,
    rankGapRatio: item.recommendation.rankGapRatio,
    eligiblePlanCount: item.eligibility.eligiblePlanCount,
    majorNames: item.majorPlans.map((plan) => plan.majorName),
  };
}

export function VolunteerReportPage() {
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const rawDraft = window.localStorage.getItem(volunteerPlanStorageKey);

        if (!rawDraft) {
          setLoadState("empty");
          return;
        }

        const parsed: unknown = JSON.parse(rawDraft);

        if (!isStoredVolunteerPlanDraft<StoredReportItem, StoredReportProfile, StoredReportAlgorithm>(parsed)) {
          setLoadState("error");
          return;
        }

        setDraft(parsed);
        setLoadState("ready");
      } catch {
        setLoadState("error");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const report = useMemo(() => {
    if (!draft) return null;

    return buildVolunteerRiskReport(draft.items.map(toReportItem), {
      profile: draft.profile,
      preferences: draft.preferences,
    });
  }, [draft]);

  async function exportPdf() {
    if (!draft || !report) return;

    setIsExportingPdf(true);
    setExportMessage(null);

    try {
      await downloadVolunteerReportPdf({
        savedAt: draft.savedAt,
        profile: draft.profile,
        preferences: draft.preferences,
        algorithm: draft.algorithm,
        report,
        planItems: draft.items.map(toPdfPlanItem),
      });
      setExportMessage("PDF 已生成，浏览器将开始下载");
    } catch (error) {
      const message =
        error instanceof Error && error.message === "CJK_FONT_NOT_FOUND"
          ? "PDF 导出失败：服务器未找到中文字体"
          : "PDF 导出失败，请回到首页重新保存后再试";
      setExportMessage(message);
    } finally {
      setIsExportingPdf(false);
    }
  }

  if (loadState === "loading") {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="mx-auto max-w-5xl rounded-lg border border-line bg-panel p-6 text-sm text-muted shadow-sm">
          正在读取本机方案草稿...
        </div>
      </main>
    );
  }

  if (!report || !draft || loadState !== "ready") {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="mx-auto grid max-w-5xl gap-4 rounded-lg border border-line bg-panel p-6 shadow-sm">
          <FileText aria-hidden className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-semibold">志愿方案报告</h1>
          <p className="text-sm leading-6 text-muted">
            {loadState === "empty" ? "本机浏览器还没有保存志愿方案。" : "已保存方案读取失败，可回到首页重新保存。"}
          </p>
          <Link
            className="inline-flex h-10 w-fit items-center gap-2 rounded border border-line px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            href="/"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </main>
    );
  }

  const statusIcon =
    report.status === "ready" ? (
      <ShieldCheck aria-hidden className="h-5 w-5" />
    ) : (
      <AlertTriangle aria-hidden className="h-5 w-5" />
    );

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex h-10 items-center gap-2 rounded border border-line bg-panel px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            href="/"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            返回首页
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded border border-line bg-panel px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isExportingPdf}
              title="导出志愿表和分析报告 PDF"
              type="button"
              onClick={exportPdf}
            >
              {isExportingPdf ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Download aria-hidden className="h-4 w-4" />
              )}
              导出 PDF
            </button>
            <span className={`inline-flex h-10 items-center gap-2 rounded border px-3 text-sm font-semibold ${getStatusClass(report.status)}`}>
              {statusIcon}
              {report.statusLabel}
            </span>
          </div>
        </div>

        {exportMessage ? (
          <div className="rounded border border-line bg-panel px-4 py-2 text-sm text-muted shadow-sm">{exportMessage}</div>
        ) : null}

        <section className="rounded-lg border border-line bg-panel p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">皖志愿</p>
              <h1 className="mt-2 text-3xl font-semibold">志愿方案风险报告</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{report.conclusion}</p>
            </div>
            <div className="rounded border border-line bg-background px-3 py-2 text-sm text-muted">
              保存 {formatDateTime(draft.savedAt)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-line bg-background p-3">
              <p className="text-sm text-muted">考生画像</p>
              <p className="mt-1 font-semibold">
                {draft.profile
                  ? `${draft.profile.targetYear} ${getSubjectTrackLabel(draft.profile.firstChoiceSubject)}`
                  : "暂无"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {draft.profile ? `${formatNumber(draft.profile.score)} 分 · ${formatNumber(draft.profile.rank)} 位` : ""}
              </p>
            </div>
            <div className="rounded border border-line bg-background p-3">
              <p className="text-sm text-muted">志愿总数</p>
              <p className="mt-1 text-2xl font-semibold">{report.metrics.total}</p>
            </div>
            <div className="rounded border border-line bg-background p-3">
              <p className="text-sm text-muted">保底数量</p>
              <p className="mt-1 text-2xl font-semibold">{report.metrics.safetyCount}</p>
            </div>
            <div className="rounded border border-line bg-background p-3">
              <p className="text-sm text-muted">低置信度</p>
              <p className="mt-1 text-2xl font-semibold">{report.metrics.lowConfidenceCount}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-lg border border-line bg-panel shadow-sm">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <BadgeCheck aria-hidden className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">风险检测清单</h2>
            </div>
            <div className="grid gap-3 p-4">
              {report.issues.length ? (
                report.issues.map((issue) => (
                  <article className={`rounded border p-4 ${getSeverityClass(issue.severity)}`} key={issue.code}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{issue.title}</h3>
                        <p className="mt-1 text-sm leading-6">{issue.message}</p>
                      </div>
                      <span className="rounded border border-current/30 px-2 py-1 text-xs font-semibold">
                        {issue.severity === "danger" ? "重点调整" : issue.severity === "warning" ? "需要复核" : "提示"}
                      </span>
                    </div>
                    {issue.evidence.length ? (
                      <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 text-sm leading-6 [scrollbar-gutter:stable]">
                        {issue.evidence.map((item) => (
                          <div className="rounded border border-current/20 bg-white/60 px-3 py-2" key={item.planKey}>
                            <p className="font-semibold">
                              {item.collegeName} {item.groupCode} · {item.tierLabel}
                            </p>
                            <p className="mt-1 break-words">{item.reasons.join("；")}</p>
                            {item.majorNames.length ? <p className="mt-1 break-words text-xs">{item.majorNames.join("、")}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded border border-success bg-success-soft p-4 text-sm leading-6 text-success">
                  未触发当前核心风险。
                </div>
              )}
            </div>
          </div>

          <aside className="grid gap-5">
            <section className="rounded-lg border border-line bg-panel p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ListChecks aria-hidden className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">调整建议</h2>
              </div>
              <div className="mt-3 grid max-h-96 gap-2 overflow-y-auto pr-1 text-sm leading-6 text-muted [scrollbar-gutter:stable]">
                {report.actionItems.map((item) => (
                  <p className="rounded border border-line bg-background px-3 py-2" key={item}>
                    {item}
                  </p>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel p-4 text-sm leading-6 text-muted shadow-sm">
              <div className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <Database aria-hidden className="h-5 w-5 text-info" />
                参考依据
              </div>
              {draft.algorithm ? (
                <p>参考年份 {draft.algorithm.referenceYears.join("、")}</p>
              ) : (
                <p>暂无参考年份。</p>
              )}
              <p className="mt-3">推荐结果只做概率参考，不构成录取承诺。</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
