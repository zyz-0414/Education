import type { Prisma } from "@prisma/client";

import { serializeCollegeGroup } from "@/lib/api/college-groups";
import { prisma } from "@/lib/db/prisma";
import {
  anhuiSubjectLabels,
  formatSubjectRequirement,
  getMissingRequiredSubjects,
  getSelectedAnhuiSubjects,
  isSubjectRequirementSatisfied,
} from "@/lib/rules/subject-requirements";
import type { CandidateProfile } from "@/lib/validators/profile";

const candidateGroupInclude = {
  college: {
    include: {
      source: true,
    },
  },
  source: true,
  majorPlans: {
    orderBy: { majorCode: "asc" },
    include: { source: true },
  },
  admissionItems: {
    orderBy: [{ year: "desc" }, { minRank: "asc" }],
    include: { source: true },
  },
} satisfies Prisma.CollegeGroupInclude;

type CandidateGroupWithRelations = Prisma.CollegeGroupGetPayload<{
  include: typeof candidateGroupInclude;
}>;

export type CandidateGroupQueryOptions = {
  requirePlan?: boolean;
  limit?: number;
  offset?: number;
};

type ScoreRankIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

const candidatePoolLimit = 5000;

function getEligibleMajorPlans(group: CandidateGroupWithRelations, selectedSubjects: ReturnType<typeof getSelectedAnhuiSubjects>) {
  return group.majorPlans.filter((plan) =>
    isSubjectRequirementSatisfied(plan.subjectRequirement ?? group.subjectRequirement, selectedSubjects),
  );
}

async function validateScoreAndRank(profile: CandidateProfile) {
  const where = {
    year: profile.targetYear,
    provinceCode: profile.provinceCode,
    subjectTrack: profile.firstChoiceSubject,
  };

  const [segment, range] = await Promise.all([
    prisma.scoreSegment.findUnique({
      where: {
        year_provinceCode_subjectTrack_score: {
          ...where,
          score: profile.score,
        },
      },
      include: { source: true },
    }),
    prisma.scoreSegment.aggregate({
      where,
      _min: { score: true, rankMin: true },
      _max: { score: true, rankMax: true },
    }),
  ]);

  const issues: ScoreRankIssue[] = [];

  if (!segment) {
    issues.push({
      code: "SCORE_SEGMENT_NOT_FOUND",
      message: `${profile.targetYear} 年${anhuiSubjectLabels[profile.firstChoiceSubject]}类一分一段表中没有 ${profile.score} 分。`,
      severity: "error",
    });
  } else if (
    segment.rankMin !== null &&
    segment.rankMax !== null &&
    (profile.rank < segment.rankMin || profile.rank > segment.rankMax)
  ) {
    issues.push({
      code: "RANK_SCORE_MISMATCH",
      message: `${profile.score} 分对应位次区间为 ${segment.rankMin.toLocaleString()}-${segment.rankMax.toLocaleString()}，当前位次 ${profile.rank.toLocaleString()} 不在该区间。`,
      severity: "error",
    });
  }

  if (range._max.rankMax !== null && profile.rank > range._max.rankMax) {
    issues.push({
      code: "RANK_OUT_OF_SEGMENT_RANGE",
      message: `当前位次超出 ${profile.targetYear} 年${anhuiSubjectLabels[profile.firstChoiceSubject]}类一分一段表覆盖范围。`,
      severity: "error",
    });
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
    segment: segment
      ? {
          score: segment.score,
          count: segment.count,
          cumulativeCount: segment.cumulativeCount,
          rankMin: segment.rankMin,
          rankMax: segment.rankMax,
          source: {
            title: segment.source.title,
            sourceUrl: segment.source.sourceUrl,
            reviewStatus: segment.source.reviewStatus,
          },
        }
      : null,
    coverage: {
      minScore: range._min.score,
      maxScore: range._max.score,
      minRank: range._min.rankMin,
      maxRank: range._max.rankMax,
    },
  };
}

export async function getCandidateCollegeGroups(
  profile: CandidateProfile,
  options: CandidateGroupQueryOptions = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), candidatePoolLimit);
  const offset = Math.max(options.offset ?? 0, 0);
  const scoreRankCheck = await validateScoreAndRank(profile);
  const selectedSubjects = getSelectedAnhuiSubjects(profile);

  if (!scoreRankCheck.valid) {
    return {
      profile,
      scoreRankCheck,
      filters: {
        batchCount: 0,
        subjectTrackCount: 0,
        subjectMatchedCount: 0,
        subjectMismatchCount: 0,
        noEligiblePlanCount: 0,
        requirePlan: Boolean(options.requirePlan),
      },
      total: 0,
      limit,
      offset,
      items: [],
    };
  }

  const batchWhere: Prisma.CollegeGroupWhereInput = {
    year: profile.targetYear,
    provinceCode: profile.provinceCode,
    batchCode: profile.batchCode,
  };
  const subjectTrackWhere: Prisma.CollegeGroupWhereInput = {
    ...batchWhere,
    subjectTrack: profile.firstChoiceSubject,
  };

  const [batchCount, subjectTrackCount, groups] = await prisma.$transaction([
    prisma.collegeGroup.count({ where: batchWhere }),
    prisma.collegeGroup.count({ where: subjectTrackWhere }),
    prisma.collegeGroup.findMany({
      where: subjectTrackWhere,
      orderBy: [
        { collegeCode: "asc" },
        { groupCode: "asc" },
      ],
      include: candidateGroupInclude,
      take: candidatePoolLimit,
    }),
  ]);

  const subjectMatched = groups
    .filter((group) => isSubjectRequirementSatisfied(group.subjectRequirement, selectedSubjects))
    .map((group) => ({
      group,
      eligibleMajorPlans: getEligibleMajorPlans(group, selectedSubjects),
    }));

  const filtered = subjectMatched.filter(
    (item) => !options.requirePlan || item.eligibleMajorPlans.length > 0,
  );
  const paged = filtered.slice(offset, offset + limit);

  return {
    profile,
    scoreRankCheck,
    filters: {
      batchCount,
      subjectTrackCount,
      subjectMatchedCount: subjectMatched.length,
      subjectMismatchCount: subjectTrackCount - subjectMatched.length,
      noEligiblePlanCount: subjectMatched.filter((item) => item.eligibleMajorPlans.length === 0).length,
      requirePlan: Boolean(options.requirePlan),
    },
    total: filtered.length,
    limit,
    offset,
    items: paged.map(({ group, eligibleMajorPlans }) => {
      const serializableGroup = {
        ...group,
        majorPlans: eligibleMajorPlans,
      };
      const latestAdmission = group.admissionItems[0] ?? null;

      return {
        ...serializeCollegeGroup(serializableGroup),
        eligibility: {
          selectedSubjects: selectedSubjects.map((subject) => ({
            value: subject,
            label: anhuiSubjectLabels[subject],
          })),
          requirement: formatSubjectRequirement(group.subjectRequirement),
          missingSubjects: getMissingRequiredSubjects(group.subjectRequirement, selectedSubjects).map(
            (subject) => anhuiSubjectLabels[subject],
          ),
          hasEligibleMajorPlan: eligibleMajorPlans.length > 0,
          eligibleMajorPlanCount: eligibleMajorPlans.length,
          eligiblePlanCount: eligibleMajorPlans.reduce((sum, plan) => sum + plan.planCount, 0),
          latestAdmission: latestAdmission
            ? {
                year: latestAdmission.year,
                minScore: latestAdmission.minScore,
                minRank: latestAdmission.minRank,
                admittedCount: latestAdmission.admittedCount,
              }
            : null,
        },
      };
    }),
  };
}
