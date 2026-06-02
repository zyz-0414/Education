import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type CollegeGroupQuery = {
  year?: number;
  provinceCode?: string;
  batchCode?: string;
  subjectTrack?: string;
  q?: string;
  collegeCode?: string;
  limit?: number;
  offset?: number;
};

export async function listCollegeGroups(query: CollegeGroupQuery) {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);

  const where: Prisma.CollegeGroupWhereInput = {
    year: query.year,
    provinceCode: query.provinceCode ?? "AH",
    batchCode: query.batchCode ?? "ordinary_undergraduate",
    subjectTrack: query.subjectTrack,
    collegeCode: query.collegeCode,
  };

  if (query.q) {
    where.OR = [
      { collegeCode: { contains: query.q } },
      { groupCode: { contains: query.q } },
      { collegeNameSnapshot: { contains: query.q } },
    ];
  }

  const [total, items] = await prisma.$transaction([
    prisma.collegeGroup.count({ where }),
    prisma.collegeGroup.findMany({
      where,
      orderBy: [
        { year: "desc" },
        { subjectTrack: "asc" },
        { collegeCode: "asc" },
        { groupCode: "asc" },
      ],
      skip: offset,
      take: limit,
      include: {
        college: true,
        source: true,
        majorPlans: {
          orderBy: { majorCode: "asc" },
          include: { source: true },
        },
        admissionItems: {
          orderBy: [{ year: "desc" }, { minRank: "asc" }],
          include: { source: true },
        },
      },
    }),
  ]);

  return {
    total,
    limit,
    offset,
    items,
  };
}

export async function getCollegeGroupByKey(params: {
  year: number;
  provinceCode: string;
  batchCode: string;
  subjectTrack: string;
  collegeCode: string;
  groupCode: string;
}) {
  return prisma.collegeGroup.findUnique({
    where: {
      year_provinceCode_batchCode_subjectTrack_collegeCode_groupCode: params,
    },
    include: {
      college: {
        include: {
          source: true,
          charterRules: {
            where: { year: params.year },
            include: { source: true },
            orderBy: { ruleType: "asc" },
          },
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
    },
  });
}
