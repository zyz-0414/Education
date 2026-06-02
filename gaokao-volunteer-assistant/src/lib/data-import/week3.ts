import { Prisma, PrismaClient } from "@prisma/client";

import {
  optionalDate,
  optionalInt,
  optionalJson,
  optionalString,
  readCsvRows,
  requiredInt,
  requiredString,
} from "./csv";
import { cleanedCsvPaths, sourceIndexPath } from "./paths";
import { anhuiProvinceConfig } from "../rules/anhui";

type SourceRow = {
  source_id: string;
  title: string;
  source_url: string;
  publisher: string;
  published_at: string;
  fetched_at: string;
  file_hash: string;
  parser_version: string;
  review_status: string;
  notes: string;
};

type ScoreSegmentRow = {
  year: string;
  province_code: string;
  subject_track: string;
  score: string;
  count: string;
  cumulative_count: string;
  rank_min: string;
  rank_max: string;
  source_id: string;
};

type CollegeRow = {
  college_code: string;
  college_name: string;
  province: string;
  city: string;
  level: string;
  ownership: string;
  tags: string;
  official_site: string;
  source_id: string;
};

type MajorRow = {
  major_code: string;
  major_name: string;
  major_category: string;
  degree_category: string;
  duration: string;
  notes: string;
  source_id: string;
};

type CollegeGroupRow = {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: string;
  college_code: string;
  group_code: string;
  college_name: string;
  subject_requirement: string;
  group_note: string;
  source_id: string;
};

type EnrollmentPlanRow = {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: string;
  college_code: string;
  group_code: string;
  major_code: string;
  major_name: string;
  subject_requirement: string;
  plan_count: string;
  tuition: string;
  duration: string;
  campus: string;
  note: string;
  source_id: string;
};

type AdmissionResultRow = {
  year: string;
  province_code: string;
  batch_code: string;
  subject_track: string;
  college_code: string;
  group_code: string;
  major_code: string;
  min_score: string;
  min_rank: string;
  avg_score: string;
  avg_rank: string;
  max_score: string;
  max_rank: string;
  admitted_count: string;
  source_id: string;
};

type CharterRuleRow = {
  year: string;
  college_code: string;
  scope_type: string;
  scope_code: string;
  rule_type: string;
  condition_json: string;
  original_text: string;
  review_status: string;
  source_id: string;
};

export type ImportSummary = Record<string, number>;

function uniqueRows<T>(rows: T[], getKey: (row: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    seen.set(getKey(row), row);
  }
  return Array.from(seen.values());
}

function toJsonObject(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

async function upsertSources(tx: Prisma.TransactionClient) {
  const rows = await readCsvRows<SourceRow>(sourceIndexPath);

  for (const row of rows) {
    const id = requiredString(row.source_id, "source_id");
    await tx.source.upsert({
      where: { id },
      create: {
        id,
        title: requiredString(row.title, "title"),
        sourceUrl: requiredString(row.source_url, "source_url"),
        publisher: optionalString(row.publisher),
        publishedAt: optionalDate(row.published_at),
        fetchedAt: optionalDate(row.fetched_at),
        fileHash: optionalString(row.file_hash),
        parserVersion: optionalString(row.parser_version),
        reviewStatus: optionalString(row.review_status) ?? "pending",
        notes: optionalString(row.notes),
      },
      update: {
        title: requiredString(row.title, "title"),
        sourceUrl: requiredString(row.source_url, "source_url"),
        publisher: optionalString(row.publisher),
        publishedAt: optionalDate(row.published_at),
        fetchedAt: optionalDate(row.fetched_at),
        fileHash: optionalString(row.file_hash),
        parserVersion: optionalString(row.parser_version),
        reviewStatus: optionalString(row.review_status) ?? "pending",
        notes: optionalString(row.notes),
      },
    });
  }

  return rows.length;
}

async function upsertPolicies(tx: Prisma.TransactionClient) {
  const { ordinaryUndergraduate } = anhuiProvinceConfig;
  const years = [2024, 2025, 2026];

  for (const year of years) {
    await tx.provincePolicy.upsert({
      where: {
        year_provinceCode_batchCode: {
          year,
          provinceCode: anhuiProvinceConfig.provinceCode,
          batchCode: ordinaryUndergraduate.batchCode,
        },
      },
      create: {
        year,
        provinceCode: anhuiProvinceConfig.provinceCode,
        batchCode: ordinaryUndergraduate.batchCode,
        examMode: anhuiProvinceConfig.examMode,
        volunteerUnitType: anhuiProvinceConfig.volunteerUnitType,
        maxVolunteers: ordinaryUndergraduate.maxVolunteers,
        majorsPerGroup: ordinaryUndergraduate.majorsPerGroup,
        hasMajorAdjustment: ordinaryUndergraduate.hasMajorAdjustment,
        policyJson: {
          firstChoiceSubjects: anhuiProvinceConfig.firstChoiceSubjects,
          secondChoiceSubjects: anhuiProvinceConfig.secondChoiceSubjects,
          dataNote: "Anhui ordinary undergraduate baseline; recheck after the 2026 policy is published.",
        },
        sourceId: "src_ah_exam",
      },
      update: {
        examMode: anhuiProvinceConfig.examMode,
        volunteerUnitType: anhuiProvinceConfig.volunteerUnitType,
        maxVolunteers: ordinaryUndergraduate.maxVolunteers,
        majorsPerGroup: ordinaryUndergraduate.majorsPerGroup,
        hasMajorAdjustment: ordinaryUndergraduate.hasMajorAdjustment,
        policyJson: {
          firstChoiceSubjects: anhuiProvinceConfig.firstChoiceSubjects,
          secondChoiceSubjects: anhuiProvinceConfig.secondChoiceSubjects,
          dataNote: "Anhui ordinary undergraduate baseline; recheck after the 2026 policy is published.",
        },
        sourceId: "src_ah_exam",
      },
    });
  }

  return years.length;
}

async function upsertScoreSegments(tx: Prisma.TransactionClient) {
  const rows = await readCsvRows<ScoreSegmentRow>(cleanedCsvPaths.scoreSegments);

  for (const row of rows) {
    const year = requiredInt(row.year, "year");
    const provinceCode = requiredString(row.province_code, "province_code");
    const subjectTrack = requiredString(row.subject_track, "subject_track");
    const score = requiredInt(row.score, "score");

    await tx.scoreSegment.upsert({
      where: {
        year_provinceCode_subjectTrack_score: {
          year,
          provinceCode,
          subjectTrack,
          score,
        },
      },
      create: {
        year,
        provinceCode,
        subjectTrack,
        score,
        count: requiredInt(row.count, "count"),
        cumulativeCount: requiredInt(row.cumulative_count, "cumulative_count"),
        rankMin: optionalInt(row.rank_min),
        rankMax: optionalInt(row.rank_max),
        sourceId: requiredString(row.source_id, "source_id"),
      },
      update: {
        count: requiredInt(row.count, "count"),
        cumulativeCount: requiredInt(row.cumulative_count, "cumulative_count"),
        rankMin: optionalInt(row.rank_min),
        rankMax: optionalInt(row.rank_max),
        sourceId: requiredString(row.source_id, "source_id"),
      },
    });
  }

  return rows.length;
}

async function upsertColleges(tx: Prisma.TransactionClient) {
  const rows = await readCsvRows<CollegeRow>(cleanedCsvPaths.colleges);
  const unique = uniqueRows(rows, (row) => requiredString(row.college_code, "college_code"));

  for (const row of unique) {
    const collegeCode = requiredString(row.college_code, "college_code");
    await tx.college.upsert({
      where: { collegeCode },
      create: {
        collegeCode,
        collegeName: requiredString(row.college_name, "college_name"),
        province: optionalString(row.province),
        city: optionalString(row.city),
        level: optionalString(row.level),
        ownership: optionalString(row.ownership),
        tags: toJsonObject(optionalJson(row.tags)),
        officialSite: optionalString(row.official_site),
        sourceId: optionalString(row.source_id),
      },
      update: {
        collegeName: requiredString(row.college_name, "college_name"),
        province: optionalString(row.province),
        city: optionalString(row.city),
        level: optionalString(row.level),
        ownership: optionalString(row.ownership),
        tags: toJsonObject(optionalJson(row.tags)),
        officialSite: optionalString(row.official_site),
        sourceId: optionalString(row.source_id),
      },
    });
  }

  return unique.length;
}

async function upsertMajors(tx: Prisma.TransactionClient) {
  const rows = await readCsvRows<MajorRow>(cleanedCsvPaths.majors);
  const unique = uniqueRows(rows, (row) =>
    [
      requiredString(row.major_code, "major_code"),
      requiredString(row.major_name, "major_name"),
      requiredString(row.source_id, "source_id"),
    ].join("|"),
  );

  for (const row of unique) {
    const majorCode = requiredString(row.major_code, "major_code");
    const majorName = requiredString(row.major_name, "major_name");
    const sourceId = requiredString(row.source_id, "source_id");

    await tx.major.upsert({
      where: {
        majorCode_majorName_sourceId: {
          majorCode,
          majorName,
          sourceId,
        },
      },
      create: {
        majorCode,
        majorName,
        majorCategory: optionalString(row.major_category),
        degreeCategory: optionalString(row.degree_category),
        duration: optionalString(row.duration),
        notes: optionalString(row.notes),
        sourceId,
      },
      update: {
        majorCategory: optionalString(row.major_category),
        degreeCategory: optionalString(row.degree_category),
        duration: optionalString(row.duration),
        notes: optionalString(row.notes),
      },
    });
  }

  return unique.length;
}

async function upsertCollegeGroups(tx: Prisma.TransactionClient) {
  const rows = await readCsvRows<CollegeGroupRow>(cleanedCsvPaths.collegeGroups);

  for (const row of rows) {
    const year = requiredInt(row.year, "year");
    const provinceCode = requiredString(row.province_code, "province_code");
    const batchCode = requiredString(row.batch_code, "batch_code");
    const subjectTrack = requiredString(row.subject_track, "subject_track");
    const collegeCode = requiredString(row.college_code, "college_code");
    const groupCode = requiredString(row.group_code, "group_code");

    await tx.collegeGroup.upsert({
      where: {
        year_provinceCode_batchCode_subjectTrack_collegeCode_groupCode: {
          year,
          provinceCode,
          batchCode,
          subjectTrack,
          collegeCode,
          groupCode,
        },
      },
      create: {
        year,
        provinceCode,
        batchCode,
        subjectTrack,
        collegeCode,
        groupCode,
        collegeNameSnapshot: optionalString(row.college_name),
        subjectRequirement: requiredString(row.subject_requirement, "subject_requirement"),
        groupNote: optionalString(row.group_note),
        sourceId: requiredString(row.source_id, "source_id"),
      },
      update: {
        collegeNameSnapshot: optionalString(row.college_name),
        subjectRequirement: requiredString(row.subject_requirement, "subject_requirement"),
        groupNote: optionalString(row.group_note),
        sourceId: requiredString(row.source_id, "source_id"),
      },
    });
  }

  return rows.length;
}

async function upsertEnrollmentPlans(tx: Prisma.TransactionClient) {
  const rows = await readCsvRows<EnrollmentPlanRow>(cleanedCsvPaths.enrollmentPlans);

  for (const row of rows) {
    const year = requiredInt(row.year, "year");
    const provinceCode = requiredString(row.province_code, "province_code");
    const batchCode = requiredString(row.batch_code, "batch_code");
    const subjectTrack = requiredString(row.subject_track, "subject_track");
    const collegeCode = requiredString(row.college_code, "college_code");
    const groupCode = requiredString(row.group_code, "group_code");
    const majorCode = requiredString(row.major_code, "major_code");

    await tx.majorPlan.upsert({
      where: {
        year_provinceCode_batchCode_subjectTrack_collegeCode_groupCode_majorCode: {
          year,
          provinceCode,
          batchCode,
          subjectTrack,
          collegeCode,
          groupCode,
          majorCode,
        },
      },
      create: {
        year,
        provinceCode,
        batchCode,
        subjectTrack,
        collegeCode,
        groupCode,
        majorCode,
        majorName: requiredString(row.major_name, "major_name"),
        subjectRequirement: optionalString(row.subject_requirement),
        planCount: requiredInt(row.plan_count, "plan_count"),
        tuition: optionalInt(row.tuition),
        duration: optionalString(row.duration),
        campus: optionalString(row.campus),
        note: optionalString(row.note),
        sourceId: requiredString(row.source_id, "source_id"),
      },
      update: {
        majorName: requiredString(row.major_name, "major_name"),
        subjectRequirement: optionalString(row.subject_requirement),
        planCount: requiredInt(row.plan_count, "plan_count"),
        tuition: optionalInt(row.tuition),
        duration: optionalString(row.duration),
        campus: optionalString(row.campus),
        note: optionalString(row.note),
        sourceId: requiredString(row.source_id, "source_id"),
      },
    });
  }

  return rows.length;
}

async function replaceAdmissionResults(tx: Prisma.TransactionClient) {
  const rows = await readCsvRows<AdmissionResultRow>(cleanedCsvPaths.admissionResults);

  await tx.admissionResult.deleteMany();
  if (rows.length === 0) {
    return 0;
  }

  await tx.admissionResult.createMany({
    data: rows.map((row) => ({
      year: requiredInt(row.year, "year"),
      provinceCode: requiredString(row.province_code, "province_code"),
      batchCode: requiredString(row.batch_code, "batch_code"),
      subjectTrack: requiredString(row.subject_track, "subject_track"),
      collegeCode: requiredString(row.college_code, "college_code"),
      groupCode: requiredString(row.group_code, "group_code"),
      majorCode: optionalString(row.major_code),
      minScore: optionalInt(row.min_score),
      minRank: optionalInt(row.min_rank),
      avgScore: optionalInt(row.avg_score),
      avgRank: optionalInt(row.avg_rank),
      maxScore: optionalInt(row.max_score),
      maxRank: optionalInt(row.max_rank),
      admittedCount: optionalInt(row.admitted_count),
      sourceId: requiredString(row.source_id, "source_id"),
    })),
  });

  return rows.length;
}

async function replaceCharterRules(tx: Prisma.TransactionClient) {
  const rows = await readCsvRows<CharterRuleRow>(cleanedCsvPaths.charterRules);

  await tx.charterRule.deleteMany();
  if (rows.length === 0) {
    return 0;
  }

  await tx.charterRule.createMany({
    data: rows.map((row) => ({
      year: requiredInt(row.year, "year"),
      collegeCode: requiredString(row.college_code, "college_code"),
      scopeType: requiredString(row.scope_type, "scope_type"),
      scopeCode: optionalString(row.scope_code),
      ruleType: requiredString(row.rule_type, "rule_type"),
      conditionJson: toJsonObject(optionalJson(row.condition_json)),
      originalText: requiredString(row.original_text, "original_text"),
      reviewStatus: optionalString(row.review_status) ?? "pending",
      sourceId: requiredString(row.source_id, "source_id"),
    })),
  });

  return rows.length;
}

export async function importWeek3Data(prisma: PrismaClient): Promise<ImportSummary> {
  return prisma.$transaction(
    async (tx) => {
      const sources = await upsertSources(tx);
      const provincePolicies = await upsertPolicies(tx);
      const colleges = await upsertColleges(tx);
      const majors = await upsertMajors(tx);
      const scoreSegments = await upsertScoreSegments(tx);
      const collegeGroups = await upsertCollegeGroups(tx);
      const enrollmentPlans = await upsertEnrollmentPlans(tx);
      const admissionResults = await replaceAdmissionResults(tx);
      const charterRules = await replaceCharterRules(tx);

      return {
        sources,
        provincePolicies,
        colleges,
        majors,
        scoreSegments,
        collegeGroups,
        enrollmentPlans,
        admissionResults,
        charterRules,
      };
    },
    { timeout: 60_000 },
  );
}
