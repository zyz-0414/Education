import { NextResponse } from "next/server";
import { z } from "zod";

import { getCollegeGroupRecommendations } from "@/lib/queries/recommendations";
import { candidateProfileSchema } from "@/lib/validators/profile";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  profile: candidateProfileSchema,
  requirePlan: z.boolean().default(false),
  includeHighRisk: z.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(100).default(45),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_PROFILE",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof getCollegeGroupRecommendations>>;

  try {
    result = await getCollegeGroupRecommendations(parsed.data.profile, {
      requirePlan: parsed.data.requirePlan,
      includeHighRisk: parsed.data.includeHighRisk,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "DATABASE_UNAVAILABLE",
        message: "数据库暂不可用，请先启动 PostgreSQL 并完成迁移和数据导入。",
      },
      { status: 503 },
    );
  }

  if (!result.scoreRankCheck.valid) {
    return NextResponse.json(
      {
        error: "SCORE_RANK_INVALID",
        result,
      },
      { status: 422 },
    );
  }

  return NextResponse.json(result);
}
