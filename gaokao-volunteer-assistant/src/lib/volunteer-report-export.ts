import type {
  VolunteerRiskReport,
  VolunteerRiskReportPreferences,
  VolunteerRiskReportProfile,
  VolunteerRiskReportTier,
} from "@/lib/volunteer-risk-report";

export type VolunteerReportPdfAlgorithm = {
  version?: string;
  dataVersion?: string;
  referenceYears?: number[];
} | null;

export type VolunteerReportPdfPlanItem = {
  planKey: string;
  order: number;
  collegeName: string;
  collegeCode?: string;
  groupCode: string;
  city?: string | null;
  tier?: VolunteerRiskReportTier | null;
  tierLabel?: string;
  referenceRank?: number | null;
  rankGapRatio?: number | null;
  eligiblePlanCount?: number | null;
  majorNames?: string[];
};

export type VolunteerReportPdfPayload = {
  savedAt?: string | null;
  profile?: VolunteerRiskReportProfile;
  preferences?: VolunteerRiskReportPreferences | null;
  algorithm?: VolunteerReportPdfAlgorithm;
  report: VolunteerRiskReport;
  planItems: VolunteerReportPdfPlanItem[];
};

function getProfileFilePart(profile: VolunteerRiskReportProfile | undefined) {
  if (!profile) return "未绑定考生";

  const subject = profile.firstChoiceSubject === "history" ? "历史类" : "物理类";
  const rank = typeof profile.rank === "number" ? `位次${profile.rank}` : "位次待补";

  return `${profile.targetYear ?? "年份待补"}-${subject}-${rank}`;
}

export function getVolunteerReportPdfFileName(payload: VolunteerReportPdfPayload) {
  return `皖志愿方案报告-${getProfileFilePart(payload.profile)}.pdf`;
}

export async function downloadVolunteerReportPdf(payload: VolunteerReportPdfPayload) {
  const response = await fetch("/api/volunteer-report/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const errorCode =
      errorPayload && typeof errorPayload === "object" && "error" in errorPayload ? String(errorPayload.error) : "";
    throw new Error(errorCode || "PDF_EXPORT_FAILED");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = getVolunteerReportPdfFileName(payload);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
