import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getSiteLikeSummary,
  hashVisitorId,
  LikeRateLimitError,
  LikeRateLimitUnavailableError,
  recordSiteLike,
  type LikeSummary,
} from "@/lib/site-likes";

export const dynamic = "force-dynamic";

const visitorCookieName = "site_like_visitor";
const visitorCookieMaxAge = 60 * 60 * 24 * 365;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

function attachVisitorCookie(response: NextResponse, visitorId: string, existing: string | undefined) {
  if (existing) return response;

  response.cookies.set({
    name: visitorCookieName,
    value: visitorId,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: visitorCookieMaxAge,
  });
  return response;
}

type LikeRouteDeps = {
  getSummary: (visitorHash: string) => Promise<LikeSummary>;
  record: (input: { visitorHash: string; rateLimitKeys: string[] }) => Promise<{ summary: LikeSummary }>;
  createVisitorId?: () => string;
  readVisitorCookie?: () => Promise<string | undefined> | string | undefined;
};

export async function handleLikeRequest(
  request: Request,
  deps: LikeRouteDeps = {
    getSummary: getSiteLikeSummary,
    record: recordSiteLike,
    createVisitorId: () => crypto.randomUUID(),
  },
) {
  const existing = deps.readVisitorCookie
    ? await deps.readVisitorCookie()
    : (await cookies()).get(visitorCookieName)?.value;
  const visitorId = existing || (deps.createVisitorId ?? (() => crypto.randomUUID()))();
  const visitorHash = hashVisitorId(visitorId);

  if (request.method === "GET") {
    const summary = await deps.getSummary(visitorHash);
    return attachVisitorCookie(NextResponse.json(summary), visitorId, existing);
  }

  if (request.method !== "POST") {
    return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }

  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  }

  try {
    const result = await deps.record({
      visitorHash,
      rateLimitKeys: [`visitor:${visitorHash}`, `ip:${getClientIp(request)}`],
    });
    return attachVisitorCookie(NextResponse.json(result.summary), visitorId, existing);
  } catch (error) {
    if (error instanceof LikeRateLimitError) {
      return NextResponse.json({ error: "LIKE_RATE_LIMITED" }, { status: 429 });
    }
    if (error instanceof LikeRateLimitUnavailableError) {
      return NextResponse.json({ error: "LIKE_RATE_LIMIT_UNAVAILABLE" }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json({ error: "LIKE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  return handleLikeRequest(request);
}

export async function POST(request: Request) {
  return handleLikeRequest(request);
}
