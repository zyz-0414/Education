import type { Prisma } from "@prisma/client";

type SourceLike = {
  id: string;
  title: string;
  sourceUrl: string;
  publisher: string | null;
  publishedAt: Date | null;
  fetchedAt: Date | null;
  fileHash: string | null;
  parserVersion: string | null;
  reviewStatus: string;
  notes: string | null;
};

type CollegeLike = {
  collegeCode: string;
  collegeName: string;
  province: string | null;
  city: string | null;
  level: string | null;
  ownership: string | null;
  tags: Prisma.JsonValue | null;
  officialSite: string | null;
  source?: SourceLike | null;
};

type MajorPlanLike = {
  majorCode: string;
  majorName: string;
  subjectRequirement: string | null;
  planCount: number;
  tuition: number | null;
  duration: string | null;
  campus: string | null;
  note: string | null;
  source: SourceLike;
};

type AdmissionResultLike = {
  year: number;
  minScore: number | null;
  minRank: number | null;
  avgScore: number | null;
  avgRank: number | null;
  maxScore: number | null;
  maxRank: number | null;
  admittedCount: number | null;
  source: SourceLike;
};

type CharterRuleLike = {
  ruleType: string;
  scopeType: string;
  scopeCode: string | null;
  conditionJson: Prisma.JsonValue | null;
  originalText: string;
  reviewStatus: string;
  source: SourceLike;
};

type CollegeGroupLike = {
  year: number;
  provinceCode: string;
  batchCode: string;
  subjectTrack: string;
  collegeCode: string;
  groupCode: string;
  subjectRequirement: string;
  groupNote: string | null;
  college: CollegeLike & {
    charterRules?: CharterRuleLike[];
  };
  source: SourceLike;
  majorPlans: MajorPlanLike[];
  admissionItems: AdmissionResultLike[];
};

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function serializeSource(source: SourceLike) {
  return {
    id: source.id,
    title: source.title,
    sourceUrl: source.sourceUrl,
    publisher: source.publisher,
    publishedAt: formatDate(source.publishedAt),
    fetchedAt: formatDate(source.fetchedAt),
    fileHash: source.fileHash,
    parserVersion: source.parserVersion,
    reviewStatus: source.reviewStatus,
    notes: source.notes,
  };
}

export function serializeCollegeGroup(group: CollegeGroupLike) {
  return {
    key: {
      year: group.year,
      provinceCode: group.provinceCode,
      batchCode: group.batchCode,
      subjectTrack: group.subjectTrack,
      collegeCode: group.collegeCode,
      groupCode: group.groupCode,
    },
    college: {
      collegeCode: group.college.collegeCode,
      collegeName: group.college.collegeName,
      province: group.college.province,
      city: group.college.city,
      level: group.college.level,
      ownership: group.college.ownership,
      tags: group.college.tags,
      officialSite: group.college.officialSite,
      source: group.college.source ? serializeSource(group.college.source) : null,
    },
    subjectRequirement: group.subjectRequirement,
    groupNote: group.groupNote,
    majorPlans: group.majorPlans.map((plan) => ({
      majorCode: plan.majorCode,
      majorName: plan.majorName,
      subjectRequirement: plan.subjectRequirement,
      planCount: plan.planCount,
      tuition: plan.tuition,
      duration: plan.duration,
      campus: plan.campus,
      note: plan.note,
      source: serializeSource(plan.source),
    })),
    admissionResults: group.admissionItems.map((result) => ({
      year: result.year,
      minScore: result.minScore,
      minRank: result.minRank,
      avgScore: result.avgScore,
      avgRank: result.avgRank,
      maxScore: result.maxScore,
      maxRank: result.maxRank,
      admittedCount: result.admittedCount,
      source: serializeSource(result.source),
    })),
    charterRules:
      group.college.charterRules?.map((rule) => ({
        ruleType: rule.ruleType,
        scopeType: rule.scopeType,
        scopeCode: rule.scopeCode,
        conditionJson: rule.conditionJson,
        originalText: rule.originalText,
        reviewStatus: rule.reviewStatus,
        source: serializeSource(rule.source),
      })) ?? [],
    source: serializeSource(group.source),
  };
}
