import { NextResponse } from "next/server";
import { z } from "zod";

import { serializeCollegeGroup } from "@/lib/api/college-groups";
import { getCollegeGroupByKey } from "@/lib/queries/college-groups";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  year: z.coerce.number().int().min(2024).max(2026),
  subjectTrack: z.enum(["physics", "history"]),
  collegeCode: z.string().trim().min(1).max(20),
  groupCode: z.string().trim().min(1).max(20),
});

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      year: string;
      subjectTrack: string;
      collegeCode: string;
      groupCode: string;
    }>;
  },
) {
  const parsed = paramsSchema.safeParse(await context.params);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_PARAMS",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const group = await getCollegeGroupByKey({
    year: parsed.data.year,
    provinceCode: "AH",
    batchCode: "ordinary_undergraduate",
    subjectTrack: parsed.data.subjectTrack,
    collegeCode: parsed.data.collegeCode,
    groupCode: parsed.data.groupCode,
  });

  if (!group) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(serializeCollegeGroup(group));
}
