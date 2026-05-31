import { NextResponse } from "next/server";
import { z } from "zod";

import { serializeCollegeGroup } from "@/lib/api/college-groups";
import { listCollegeGroups } from "@/lib/queries/college-groups";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2026).optional(),
  provinceCode: z.string().trim().default("AH"),
  batchCode: z.string().trim().default("ordinary_undergraduate"),
  subjectTrack: z.enum(["physics", "history"]).optional(),
  q: z.string().trim().max(80).optional(),
  collegeCode: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const result = await listCollegeGroups(parsed.data);

  return NextResponse.json({
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    items: result.items.map(serializeCollegeGroup),
  });
}
