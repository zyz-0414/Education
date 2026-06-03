import { existsSync } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";

import type { VolunteerRiskReportIssue, VolunteerRiskReportSeverity } from "@/lib/volunteer-risk-report";
import type { VolunteerReportPdfPayload, VolunteerReportPdfPlanItem } from "@/lib/volunteer-report-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_MARGIN = 44;
const FOOTER_MARGIN = 66;
const CONTENT_WIDTH = 507;
const CARD_RADIUS = 6;

const LINE_COLOR = "#d8dde4";
const TEXT_COLOR = "#1f2933";
const MUTED_COLOR = "#5f6b7a";
const BACKGROUND_COLOR = "#f4f6f2";
const PANEL_COLOR = "#f7f9fb";
const ACCENT_COLOR = "#20756b";
const ACCENT_STRONG_COLOR = "#14574f";
const ACCENT_SOFT_COLOR = "#e4f2ee";
const SUCCESS_COLOR = "#2e7d32";
const SUCCESS_SOFT_COLOR = "#e8f5e9";
const INFO_COLOR = "#2864a4";
const INFO_SOFT_COLOR = "#e6f0fb";
const WARNING_COLOR = "#9b6b14";
const WARNING_SOFT_COLOR = "#fff4d8";
const DANGER_COLOR = "#b53c32";
const DANGER_SOFT_COLOR = "#fde8e3";

type ReportFonts = {
  normal: string;
  bold: string;
};

type TextStyle = {
  fontName: string;
  fontSize: number;
  color?: string;
  width?: number;
  lineGap?: number;
  align?: "left" | "center" | "right";
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVolunteerReportPdfPayload(value: unknown): value is VolunteerReportPdfPayload {
  return isObject(value) && isObject(value.report) && Array.isArray(value.planItems);
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("zh-CN") : "暂无";
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number") return "暂无";

  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "暂无";

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSubjectLabel(value: "physics" | "history" | undefined) {
  return value === "history" ? "历史类" : "物理类";
}

function getRiskPreferenceLabel(value: "conservative" | "balanced" | "aggressive" | undefined) {
  if (value === "conservative") return "稳妥";
  if (value === "aggressive") return "进取";
  return "均衡";
}

function getSeverityLabel(severity: VolunteerRiskReportSeverity) {
  if (severity === "danger") return "重点调整";
  if (severity === "warning") return "需要复核";
  return "提示";
}

function getSeverityColor(severity: VolunteerRiskReportSeverity) {
  if (severity === "danger") return DANGER_COLOR;
  if (severity === "warning") return WARNING_COLOR;
  return INFO_COLOR;
}

function getSeveritySoftColor(severity: VolunteerRiskReportSeverity) {
  if (severity === "danger") return DANGER_SOFT_COLOR;
  if (severity === "warning") return WARNING_SOFT_COLOR;
  return INFO_SOFT_COLOR;
}

function getTierByLabel(label: string | undefined) {
  const normalized = (label ?? "").trim();

  if (!normalized) return null;
  if (normalized === "过保" || normalized.includes("very_safe")) return "very_safe";
  if (normalized === "高危" || normalized.includes("high_risk")) return "high_risk";
  if (normalized === "冲" || normalized.includes("reach")) return "reach";
  if (normalized === "稳" || normalized.includes("match")) return "match";
  if (normalized === "保" || normalized.includes("safe")) return "safe";

  return null;
}

function getTierTone(item: Pick<VolunteerReportPdfPlanItem, "tier" | "tierLabel">) {
  const tier = item.tier ?? getTierByLabel(item.tierLabel);

  switch (tier) {
    case "reach":
      return { color: INFO_COLOR, fill: INFO_SOFT_COLOR, stroke: INFO_COLOR };
    case "match":
      return { color: ACCENT_STRONG_COLOR, fill: ACCENT_SOFT_COLOR, stroke: ACCENT_COLOR };
    case "safe":
      return { color: SUCCESS_COLOR, fill: SUCCESS_SOFT_COLOR, stroke: SUCCESS_COLOR };
    case "very_safe":
      return { color: MUTED_COLOR, fill: BACKGROUND_COLOR, stroke: LINE_COLOR };
    case "high_risk":
      return { color: DANGER_COLOR, fill: DANGER_SOFT_COLOR, stroke: DANGER_COLOR };
    default:
      return { color: WARNING_COLOR, fill: WARNING_SOFT_COLOR, stroke: WARNING_COLOR };
  }
}

function sanitizeFileNamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

function getExportFileName(payload: VolunteerReportPdfPayload) {
  const profile = payload.profile;
  const subject = profile?.firstChoiceSubject === "history" ? "历史类" : "物理类";
  const year = profile?.targetYear ?? "年份待补";
  const rank = typeof profile?.rank === "number" ? `位次${profile.rank}` : "位次待补";

  return sanitizeFileNamePart(`安徽高考志愿方案报告-${year}-${subject}-${rank}.pdf`);
}

function findFontPath() {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
    "C:\\Windows\\Fonts\\Deng.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
    "C:\\Windows\\Fonts\\simsunb.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function findBoldFontPath() {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Bold.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Bold.otf"),
    "C:\\Windows\\Fonts\\Dengb.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Bold.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/System/Library/Fonts/PingFang.ttc",
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function resetCursor(doc: PDFKit.PDFDocument) {
  doc.x = PAGE_MARGIN;
}

function pageBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - FOOTER_MARGIN;
}

function usablePageHeight(doc: PDFKit.PDFDocument) {
  return pageBottom(doc) - PAGE_MARGIN;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  resetCursor(doc);

  if (doc.y + height > pageBottom(doc)) {
    doc.addPage();
    resetCursor(doc);
  }
}

function setTextStyle(doc: PDFKit.PDFDocument, style: TextStyle) {
  doc.font(style.fontName).fontSize(style.fontSize).fillColor(style.color ?? TEXT_COLOR);
}

function textHeight(doc: PDFKit.PDFDocument, text: string, style: TextStyle) {
  setTextStyle(doc, style);

  return doc.heightOfString(text, {
    align: style.align,
    lineGap: style.lineGap ?? 2,
    width: style.width ?? CONTENT_WIDTH,
  });
}

function writeText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, style: TextStyle) {
  setTextStyle(doc, style);
  doc.text(text, x, y, {
    align: style.align,
    lineGap: style.lineGap ?? 2,
    width: style.width ?? CONTENT_WIDTH,
  });
  resetCursor(doc);
}

function drawParagraph(doc: PDFKit.PDFDocument, text: string, style: TextStyle, spacing = 9) {
  const height = textHeight(doc, text, style);

  ensureSpace(doc, height + spacing);
  writeText(doc, text, PAGE_MARGIN, doc.y, style);
  doc.y += spacing;
  resetCursor(doc);
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, fonts: ReportFonts) {
  ensureSpace(doc, 42);
  doc.y += 8;

  const y = doc.y;
  doc.roundedRect(PAGE_MARGIN, y + 2, 5, 19, 2).fill(ACCENT_COLOR);
  writeText(doc, title, PAGE_MARGIN + 14, y, {
    fontName: fonts.bold,
    fontSize: 16,
    color: TEXT_COLOR,
    lineGap: 1,
    width: CONTENT_WIDTH - 14,
  });
  doc.y = y + 31;
}

function drawPill(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options: { fill: string; color: string; stroke?: string; width?: number },
  fonts: ReportFonts,
) {
  const width = options.width ?? Math.max(58, doc.widthOfString(text) + 22);

  if (options.stroke) {
    doc.roundedRect(x, y, width, 20, 4).fillAndStroke(options.fill, options.stroke);
  } else {
    doc.roundedRect(x, y, width, 20, 4).fill(options.fill);
  }
  writeText(doc, text, x, y + 4, {
    fontName: fonts.bold,
    fontSize: 8,
    color: options.color,
    align: "center",
    lineGap: 0,
    width,
  });
}

function drawHeader(doc: PDFKit.PDFDocument, payload: VolunteerReportPdfPayload, fonts: ReportFonts) {
  const profile = payload.profile;
  const meta = `${profile?.targetYear ?? "年份待补"} · ${getSubjectLabel(profile?.firstChoiceSubject)} · 位次 ${formatNumber(
    profile?.rank,
  )}`;
  const subtitle = "用于复核志愿结构、费用风险、专业组置信度与后续调整方向。";
  const y = doc.y;

  doc.rect(0, 0, doc.page.width, 5).fill(ACCENT_COLOR);
  doc.roundedRect(PAGE_MARGIN, y, 5, 56, 2).fill(ACCENT_COLOR);
  writeText(doc, "安徽高考志愿方案报告", PAGE_MARGIN + 16, y + 2, {
    fontName: fonts.bold,
    fontSize: 23,
    color: TEXT_COLOR,
    lineGap: 1,
    width: CONTENT_WIDTH - 16,
  });
  writeText(doc, subtitle, PAGE_MARGIN + 16, y + 34, {
    fontName: fonts.normal,
    fontSize: 10,
    color: MUTED_COLOR,
    width: CONTENT_WIDTH - 16,
  });
  drawPill(doc, meta, PAGE_MARGIN + CONTENT_WIDTH - 180, y + 6, {
    fill: ACCENT_SOFT_COLOR,
    color: ACCENT_COLOR,
    width: 180,
  }, fonts);
  doc.y = y + 76;
}

function drawSummaryBox(doc: PDFKit.PDFDocument, payload: VolunteerReportPdfPayload, fonts: ReportFonts) {
  const color = payload.report.status === "high_risk" ? DANGER_COLOR : payload.report.status === "needs_attention" ? WARNING_COLOR : ACCENT_COLOR;
  const fill = payload.report.status === "high_risk" ? DANGER_SOFT_COLOR : payload.report.status === "needs_attention" ? WARNING_SOFT_COLOR : ACCENT_SOFT_COLOR;
  const text = `${payload.report.statusLabel}：${payload.report.conclusion}`;
  const textStyle: TextStyle = {
    fontName: fonts.bold,
    fontSize: 11,
    color,
    lineGap: 4,
    width: CONTENT_WIDTH - 28,
  };
  const textBoxHeight = textHeight(doc, text, textStyle);
  const height = Math.max(64, textBoxHeight + 38);

  ensureSpace(doc, height + 4);
  const y = doc.y;

  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, height, CARD_RADIUS).fill(fill);
  doc.roundedRect(PAGE_MARGIN, y, 6, height, CARD_RADIUS).fill(color);
  writeText(doc, "整体结论", PAGE_MARGIN + 18, y + 12, {
    fontName: fonts.normal,
    fontSize: 9,
    color: MUTED_COLOR,
    width: CONTENT_WIDTH - 28,
  });
  writeText(doc, text, PAGE_MARGIN + 18, y + 30, textStyle);
  doc.y = y + height + 13;
}

function drawMetricGrid(
  doc: PDFKit.PDFDocument,
  items: Array<{ label: string; value: string; tone?: "accent" | "danger" | "warning" | "info" }>,
  fonts: ReportFonts,
) {
  const columns = 3;
  const gap = 10;
  const columnWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const rowHeight = 62;

  for (let index = 0; index < items.length; index += columns) {
    ensureSpace(doc, rowHeight + 9);
    const row = items.slice(index, index + columns);
    const y = doc.y;

    row.forEach((item, offset) => {
      const x = PAGE_MARGIN + offset * (columnWidth + gap);
      const valueColor =
        item.tone === "danger"
          ? DANGER_COLOR
          : item.tone === "warning"
            ? WARNING_COLOR
            : item.tone === "info"
              ? INFO_COLOR
              : TEXT_COLOR;

      doc.roundedRect(x, y, columnWidth, rowHeight, CARD_RADIUS).fillAndStroke(PANEL_COLOR, LINE_COLOR);
      writeText(doc, item.label, x + 11, y + 11, {
        fontName: fonts.normal,
        fontSize: 8.5,
        color: MUTED_COLOR,
        width: columnWidth - 22,
      });
      writeText(doc, item.value, x + 11, y + 31, {
        fontName: fonts.bold,
        fontSize: 12,
        color: valueColor,
        width: columnWidth - 22,
        lineGap: 1,
      });
    });

    doc.y = y + rowHeight + 9;
  }
}

function drawPlanItem(doc: PDFKit.PDFDocument, item: VolunteerReportPdfPlanItem, fonts: ReportFonts) {
  const metaText = [
    `${item.collegeCode ?? "院校代码待补"}-${item.groupCode}`,
    item.city ? `城市 ${item.city}` : null,
    `档位 ${item.tierLabel ?? "待确认"}`,
    `参考位次 ${formatNumber(item.referenceRank)}`,
    `位次差 ${formatPercent(item.rankGapRatio)}`,
    `计划 ${formatNumber(item.eligiblePlanCount)} 人`,
  ]
    .filter(Boolean)
    .join(" · ");
  const majorText = item.majorNames?.length ? `专业：${item.majorNames.join("、")}` : "专业：暂无明细";
  const title = `${item.order}. ${item.collegeName}`;
  const bodyWidth = CONTENT_WIDTH - 28;
  const titleWidth = bodyWidth - 88;
  const titleStyle: TextStyle = { fontName: fonts.bold, fontSize: 11.5, color: TEXT_COLOR, lineGap: 2, width: titleWidth };
  const metaStyle: TextStyle = { fontName: fonts.normal, fontSize: 8.5, color: MUTED_COLOR, lineGap: 2, width: bodyWidth };
  const majorStyle: TextStyle = { fontName: fonts.normal, fontSize: 8.8, color: TEXT_COLOR, lineGap: 3, width: bodyWidth };
  const tierTone = getTierTone(item);
  const titleHeight = textHeight(doc, title, titleStyle);
  const metaHeight = textHeight(doc, metaText, metaStyle);
  const majorHeight = textHeight(doc, majorText, majorStyle);
  const cardHeight = Math.max(82, titleHeight + metaHeight + majorHeight + 34);
  const maxCardHeight = usablePageHeight(doc) - 8;
  const isLargeItem = cardHeight > maxCardHeight;

  if (isLargeItem) {
    ensureSpace(doc, titleHeight + metaHeight + 48);
    const y = doc.y;
    const headerHeight = Math.max(58, titleHeight + metaHeight + 31);

    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, headerHeight, CARD_RADIUS).fillAndStroke("#ffffff", LINE_COLOR);
    doc.roundedRect(PAGE_MARGIN, y, 4, headerHeight, CARD_RADIUS).fill(tierTone.stroke);
    writeText(doc, title, PAGE_MARGIN + 14, y + 11, titleStyle);
    drawPill(doc, item.tierLabel ?? "待确认", PAGE_MARGIN + CONTENT_WIDTH - 86, y + 11, {
      fill: tierTone.fill,
      color: tierTone.color,
      stroke: tierTone.stroke,
      width: 72,
    }, fonts);
    writeText(doc, metaText, PAGE_MARGIN + 14, y + 15 + titleHeight, metaStyle);
    doc.y = y + headerHeight + 7;
    drawParagraph(doc, majorText, { ...majorStyle, width: CONTENT_WIDTH - 12 }, 10);
    return;
  }

  ensureSpace(doc, cardHeight + 8);
  const y = doc.y;

  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, cardHeight, CARD_RADIUS).fillAndStroke("#ffffff", LINE_COLOR);
  doc.roundedRect(PAGE_MARGIN, y, 4, cardHeight, CARD_RADIUS).fill(tierTone.stroke);
  writeText(doc, title, PAGE_MARGIN + 14, y + 11, titleStyle);
  drawPill(doc, item.tierLabel ?? "待确认", PAGE_MARGIN + CONTENT_WIDTH - 86, y + 11, {
    fill: tierTone.fill,
    color: tierTone.color,
    stroke: tierTone.stroke,
    width: 72,
  }, fonts);
  writeText(doc, metaText, PAGE_MARGIN + 14, y + 16 + titleHeight, metaStyle);
  writeText(doc, majorText, PAGE_MARGIN + 14, y + 22 + titleHeight + metaHeight, majorStyle);
  doc.y = y + cardHeight + 8;
}

function drawIssueHeader(doc: PDFKit.PDFDocument, issue: VolunteerRiskReportIssue, fonts: ReportFonts) {
  const color = getSeverityColor(issue.severity);
  const fill = getSeveritySoftColor(issue.severity);
  const titleStyle: TextStyle = { fontName: fonts.bold, fontSize: 12.5, color, lineGap: 2, width: CONTENT_WIDTH - 132 };
  const messageStyle: TextStyle = { fontName: fonts.normal, fontSize: 9.5, color: TEXT_COLOR, lineGap: 3, width: CONTENT_WIDTH - 28 };
  const titleHeight = textHeight(doc, issue.title, titleStyle);
  const messageHeight = textHeight(doc, issue.message, messageStyle);
  const height = Math.max(74, titleHeight + messageHeight + 42);

  ensureSpace(doc, height + 8);
  const y = doc.y;

  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, height, CARD_RADIUS).fill(fill);
  doc.roundedRect(PAGE_MARGIN, y, 6, height, CARD_RADIUS).fill(color);
  writeText(doc, issue.title, PAGE_MARGIN + 18, y + 13, titleStyle);
  drawPill(doc, getSeverityLabel(issue.severity), PAGE_MARGIN + CONTENT_WIDTH - 104, y + 13, {
    fill: "#ffffff",
    color,
    width: 84,
  }, fonts);
  writeText(doc, issue.message, PAGE_MARGIN + 18, y + 21 + titleHeight, messageStyle);
  doc.y = y + height + 6;
}

function drawEvidenceItem(
  doc: PDFKit.PDFDocument,
  evidence: VolunteerRiskReportIssue["evidence"][number],
  issue: VolunteerRiskReportIssue,
  fonts: ReportFonts,
) {
  const heading = `${evidence.collegeName} ${evidence.groupCode} · ${evidence.tierLabel}`;
  const detail = [
    evidence.reasons.join("；"),
    evidence.majorNames.length ? `专业：${evidence.majorNames.join("、")}` : null,
  ]
    .filter(Boolean)
    .join("；");
  const headingStyle: TextStyle = { fontName: fonts.bold, fontSize: 9.2, color: TEXT_COLOR, lineGap: 2, width: CONTENT_WIDTH - 36 };
  const detailStyle: TextStyle = { fontName: fonts.normal, fontSize: 8.5, color: MUTED_COLOR, lineGap: 2.5, width: CONTENT_WIDTH - 36 };
  const headingHeight = textHeight(doc, heading, headingStyle);
  const detailHeight = textHeight(doc, detail, detailStyle);
  const height = headingHeight + detailHeight + 16;

  ensureSpace(doc, Math.min(height + 4, usablePageHeight(doc)));
  const y = doc.y;

  if (height <= usablePageHeight(doc) - 8) {
    doc.roundedRect(PAGE_MARGIN + 10, y, CONTENT_WIDTH - 10, height, 4).fillAndStroke("#ffffff", LINE_COLOR);
  }
  doc.circle(PAGE_MARGIN + 22, y + 14, 2.4).fill(getSeverityColor(issue.severity));
  writeText(doc, heading, PAGE_MARGIN + 32, y + 7, headingStyle);
  writeText(doc, detail, PAGE_MARGIN + 32, y + 10 + headingHeight, detailStyle);
  doc.y = y + height + 4;
}

function drawIssue(doc: PDFKit.PDFDocument, issue: VolunteerRiskReportIssue, fonts: ReportFonts) {
  drawIssueHeader(doc, issue, fonts);

  if (issue.evidence.length === 0) {
    drawParagraph(doc, "暂无明细证据。", {
      fontName: fonts.normal,
      fontSize: 9,
      color: MUTED_COLOR,
      lineGap: 2,
      width: CONTENT_WIDTH,
    });
    return;
  }

  for (const evidence of issue.evidence) {
    drawEvidenceItem(doc, evidence, issue, fonts);
  }

  doc.y += 4;
}

function drawActionItems(doc: PDFKit.PDFDocument, items: string[], fonts: ReportFonts) {
  if (items.length === 0) {
    drawParagraph(doc, "暂无调整建议。", {
      fontName: fonts.normal,
      fontSize: 10,
      color: MUTED_COLOR,
      width: CONTENT_WIDTH,
    });
    return;
  }

  for (const item of items) {
    const text = `• ${item}`;
    const style: TextStyle = { fontName: fonts.normal, fontSize: 9.5, color: TEXT_COLOR, lineGap: 3, width: CONTENT_WIDTH - 18 };
    const height = textHeight(doc, text, style) + 10;

    ensureSpace(doc, height);
    const y = doc.y;
    writeText(doc, text, PAGE_MARGIN + 8, y, style);
    doc.y = y + height;
  }
}

function drawFooter(doc: PDFKit.PDFDocument, fonts: ReportFonts) {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    resetCursor(doc);

    const originalBottomMargin = doc.page.margins.bottom;
    const footerY = doc.page.height - 42;

    doc.page.margins.bottom = 0;
    doc.moveTo(PAGE_MARGIN, footerY - 8).lineTo(PAGE_MARGIN + CONTENT_WIDTH, footerY - 8).strokeColor(LINE_COLOR).stroke();
    setTextStyle(doc, { fontName: fonts.normal, fontSize: 8, color: MUTED_COLOR, width: CONTENT_WIDTH, align: "center" });
    doc.text(`第 ${index + 1} / ${range.count} 页`, PAGE_MARGIN, footerY, {
      align: "center",
      lineBreak: false,
      width: CONTENT_WIDTH,
    });
    doc.page.margins.bottom = originalBottomMargin;
  }
}

export async function renderVolunteerReportPdf(payload: VolunteerReportPdfPayload) {
  const fontPath = findFontPath();
  const boldFontPath = findBoldFontPath() ?? fontPath;

  if (!fontPath || !boldFontPath) {
    throw new Error("CJK_FONT_NOT_FOUND");
  }

  const doc = new PDFDocument({
    bufferPages: true,
    font: fontPath,
    margins: {
      top: PAGE_MARGIN,
      bottom: FOOTER_MARGIN,
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
    },
    size: "A4",
    info: {
      Title: "安徽高考志愿方案报告",
      Author: "安徽优先高考志愿填报系统",
    },
  });
  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const fonts = {
    normal: "report-normal",
    bold: "report-bold",
  };
  const profile = payload.profile;

  doc.registerFont(fonts.normal, fontPath);
  doc.registerFont(fonts.bold, boldFontPath);
  doc.font(fonts.normal);
  resetCursor(doc);

  drawHeader(doc, payload, fonts);

  drawSectionTitle(doc, "一、结论", fonts);
  drawSummaryBox(doc, payload, fonts);
  drawMetricGrid(
    doc,
    [
      { label: "保存时间", value: formatDateTime(payload.savedAt) },
      { label: "生成时间", value: formatDateTime(payload.report.generatedAt) },
      { label: "志愿总数", value: String(payload.report.metrics.total), tone: "info" },
      { label: "冲高数量", value: String(payload.report.metrics.reachOrHighRiskCount), tone: "warning" },
      { label: "保底数量", value: String(payload.report.metrics.safetyCount), tone: "accent" },
      { label: "最高学费", value: formatNumber(payload.report.metrics.maxKnownTuition), tone: "danger" },
    ],
    fonts,
  );

  drawSectionTitle(doc, "二、考生画像", fonts);
  drawMetricGrid(
    doc,
    [
      { label: "年份与科类", value: `${profile?.targetYear ?? "暂无"} · ${getSubjectLabel(profile?.firstChoiceSubject)}` },
      { label: "成绩与位次", value: `${formatNumber(profile?.score)} 分 · ${formatNumber(profile?.rank)} 位` },
      { label: "风险偏好", value: getRiskPreferenceLabel(profile?.riskPreference) },
      { label: "学费预算", value: formatNumber(payload.preferences?.tuitionLimit) },
      {
        label: "排斥方向",
        value: payload.preferences?.rejectedMajorCategories?.length
          ? payload.preferences.rejectedMajorCategories.join("、")
          : "暂无",
      },
      { label: "参考年份", value: payload.algorithm?.referenceYears?.join("、") ?? "暂无" },
    ],
    fonts,
  );

  drawSectionTitle(doc, "三、志愿表", fonts);
  if (payload.planItems.length) {
    for (const item of payload.planItems) {
      drawPlanItem(doc, item, fonts);
    }
  } else {
    drawParagraph(doc, "暂无志愿表条目。", {
      fontName: fonts.normal,
      fontSize: 10,
      color: MUTED_COLOR,
      width: CONTENT_WIDTH,
    });
  }

  drawSectionTitle(doc, "四、风险检测", fonts);
  if (payload.report.issues.length) {
    for (const issue of payload.report.issues) {
      drawIssue(doc, issue, fonts);
    }
  } else {
    drawParagraph(doc, "未触发滑档、保底不足、排斥专业、高学费或低置信度风险。", {
      fontName: fonts.normal,
      fontSize: 10,
      color: MUTED_COLOR,
      width: CONTENT_WIDTH,
    });
  }

  drawSectionTitle(doc, "五、调整建议", fonts);
  drawActionItems(doc, payload.report.actionItems, fonts);

  drawSectionTitle(doc, "六、数据口径", fonts);
  drawParagraph(
    doc,
    payload.algorithm
      ? `${payload.algorithm.version ?? "算法版本待补"}；${payload.algorithm.dataVersion ?? "数据版本待补"}；参考年份 ${
          payload.algorithm.referenceYears?.join("、") ?? "暂无"
        }。推荐结果只作概率参考，不构成录取承诺。`
      : "暂无算法版本快照。推荐结果只作概率参考，不构成录取承诺。",
    {
      fontName: fonts.normal,
      fontSize: 9,
      color: MUTED_COLOR,
      lineGap: 3,
      width: CONTENT_WIDTH,
    },
  );

  drawFooter(doc, fonts);
  doc.end();

  return bufferPromise;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isVolunteerReportPdfPayload(payload)) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const buffer = await renderVolunteerReportPdf(payload);
    const fileName = getExportFileName(payload);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const code = error instanceof Error && error.message === "CJK_FONT_NOT_FOUND" ? "CJK_FONT_NOT_FOUND" : "PDF_EXPORT_FAILED";
    console.error("Volunteer report PDF export failed", error);

    return NextResponse.json({ error: code }, { status: 500 });
  }
}
