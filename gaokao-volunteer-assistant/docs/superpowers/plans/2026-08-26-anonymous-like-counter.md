# Anonymous Like Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Add a real, anonymous, abuse-resistant site-like counter that starts at 276 and persists across public Vercel visitors.

**Architecture:** A server-side module owns the reaction key, visitor hashing, Prisma transaction, and rate-limit contract. The App Router route sets an opaque cookie and exposes the persisted summary; the client renders the heart state only after the server confirms it. Upstash Redis throttles writes across Vercel instances, while PostgreSQL's unique vote constraint prevents duplicate counting.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL (Neon), Lucide React, Upstash Redis and Ratelimit, Node crypto, tsx and Node strict assertions.

## Global Constraints

- The initial persisted count is exactly \`276\`; the browser never submits a count or visitor identifier.
- Do not add authentication, user profiles, analytics, or a CAPTCHA.
- Use a random \`HttpOnly\`, \`Secure\`, \`SameSite=Lax\` cookie; persist only its SHA-256 hash.
- Require \`UPSTASH_REDIS_REST_URL\` and \`UPSTASH_REDIS_REST_TOKEN\` in Vercel before enabling production writes. Missing credentials return HTTP 503 and never record a vote.
- Limit POST requests by anonymous visitor hash and client IP. PostgreSQL is the source of truth for one browser cookie equals one vote.
- Keep the existing workbench visual language and use Lucide \`Heart\`.

---

## File Structure

- Create: \`src/lib/site-likes.ts\` - reaction constants, visitor hashing, rate-limit interface, and transactional service.
- Create: \`src/app/api/likes/route.ts\` - cookie ownership and HTTP GET/POST mapping.
- Create: \`tests/site-likes.ts\` - service and route-contract tests.
- Create: \`prisma/migrations/20260826000000_add_site_likes/migration.sql\` - persistent tables, unique vote constraint, and seeded count.
- Modify: \`prisma/schema.prisma\` - Prisma models for the counter and votes.
- Modify: \`package.json\` and \`package-lock.json\` - Upstash dependencies and focused test command.
- Modify: \`.env.example\` - required Upstash variables without secrets.
- Modify: \`src/components/profile-form/candidate-profile-workspace.tsx\` - fetch and render the heart control.

### Task 1: Persistent Reaction Service

**Files:**
- Create: \`prisma/migrations/20260826000000_add_site_likes/migration.sql\`
- Modify: \`prisma/schema.prisma\`
- Create: \`src/lib/site-likes.ts\`
- Create: \`tests/site-likes.ts\`
- Modify: \`package.json\` and \`package-lock.json\`

**Interfaces:**
- Produces \`SITE_LIKE_KEY\`, \`LikeSummary\`, \`hashVisitorId\`, \`getSiteLikeSummary\`, and \`recordSiteLike\`.
- \`recordSiteLike({ visitorHash, rateLimitKeys })\` returns \`{ kind: "counted" | "already_liked"; summary: LikeSummary }\`.
- Throws \`LikeRateLimitError\` when Redis rejects a key and \`LikeRateLimitUnavailableError\` when its credentials are absent.

- [ ] **Step 1: Write the failing service test**

\`\`\`ts
import assert from "node:assert/strict";
import { createSiteLikeService } from "@/lib/site-likes";

const service = createSiteLikeService(createFakeRepository(), createAllowingLimiter());
const first = await service.record({ visitorHash: "visitor-a", rateLimitKeys: ["visitor-a", "ip-a"] });
assert.deepEqual(first, { kind: "counted", summary: { count: 277, liked: true } });

const duplicate = await service.record({ visitorHash: "visitor-a", rateLimitKeys: ["visitor-a", "ip-a"] });
assert.deepEqual(duplicate, { kind: "already_liked", summary: { count: 277, liked: true } });
\`\`\`

- [ ] **Step 2: Run the test to prove it fails**

Run: \`npx tsx tests/site-likes.ts\`

Expected: module-resolution failure for \`@/lib/site-likes\`.

- [ ] **Step 3: Add the Prisma models and SQL migration**

\`\`\`prisma
model SiteReaction {
  key       String   @id
  count     Int      @default(276)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  votes     SiteReactionVote[]
  @@map("site_reaction")
}

model SiteReactionVote {
  id          String       @id @default(uuid())
  reactionKey String
  visitorHash String
  createdAt   DateTime     @default(now())
  reaction    SiteReaction @relation(fields: [reactionKey], references: [key], onDelete: Cascade)
  @@unique([reactionKey, visitorHash])
  @@index([reactionKey, createdAt])
  @@map("site_reaction_vote")
}
\`\`\`

\`\`\`sql
CREATE TABLE "site_reaction" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 276,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_reaction_pkey" PRIMARY KEY ("key")
);
CREATE TABLE "site_reaction_vote" (
  "id" TEXT NOT NULL,
  "reactionKey" TEXT NOT NULL,
  "visitorHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_reaction_vote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "site_reaction_vote_reactionKey_visitorHash_key" UNIQUE ("reactionKey", "visitorHash"),
  CONSTRAINT "site_reaction_vote_reactionKey_fkey" FOREIGN KEY ("reactionKey") REFERENCES "site_reaction"("key") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "site_reaction_vote_reactionKey_createdAt_idx" ON "site_reaction_vote"("reactionKey", "createdAt");
INSERT INTO "site_reaction" ("key", "count", "updatedAt") VALUES ('site', 276, CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
\`\`\`

- [ ] **Step 4: Implement the minimal service and limiter adapter**

\`\`\`ts
export const SITE_LIKE_KEY = "site";
export type LikeSummary = { count: number; liked: boolean };

export function hashVisitorId(visitorId: string) {
  return createHash("sha256").update(visitorId).digest("hex");
}

export async function recordSiteLike(input: { visitorHash: string; rateLimitKeys: string[] }) {
  await enforceRateLimits(input.rateLimitKeys);
  return prisma.$transaction(async (tx) => {
    const vote = await tx.siteReactionVote.findUnique({
      where: { reactionKey_visitorHash: { reactionKey: SITE_LIKE_KEY, visitorHash: input.visitorHash } },
    });
    if (vote) return { kind: "already_liked" as const, summary: await getSummary(tx, input.visitorHash) };
    await tx.siteReactionVote.create({ data: { reactionKey: SITE_LIKE_KEY, visitorHash: input.visitorHash } });
    const reaction = await tx.siteReaction.update({ where: { key: SITE_LIKE_KEY }, data: { count: { increment: 1 } } });
    return { kind: "counted" as const, summary: { count: reaction.count, liked: true } };
  });
}
\`\`\`

Install \`@upstash/redis\` and \`@upstash/ratelimit\`. Use \`Ratelimit.slidingWindow(5, "1 m")\`; initialize only when both required environment variables exist.

- [ ] **Step 5: Verify service behavior and schema**

Run: \`npx tsx tests/site-likes.ts; npm run db:validate\`

Expected: first vote changes 276 to 277; duplicate remains 277; separate visitor increments once; rejected rate limits do not mutate the repository; Prisma exits 0.

- [ ] **Step 6: Commit the service foundation**

\`\`\`bash
git add prisma/schema.prisma prisma/migrations/20260826000000_add_site_likes/migration.sql src/lib/site-likes.ts tests/site-likes.ts package.json package-lock.json
git commit -m "feat: add persistent site likes"
\`\`\`

### Task 2: Protected HTTP Endpoint

**Files:**
- Create: \`src/app/api/likes/route.ts\`
- Modify: \`.env.example\`
- Modify: \`tests/site-likes.ts\`

**Interfaces:**
- Consumes the Task 1 service.
- Produces \`GET /api/likes\` as \`{ count: number, liked: boolean }\` and \`POST /api/likes\` as \`{ count: number, liked: true }\`.
- The UI in Task 3 consumes only those JSON fields.

- [ ] **Step 1: Write failing endpoint-contract tests**

\`\`\`ts
assert.equal(await getLikeRouteResponse({ method: "GET", cookie: undefined }).status, 200);
assert.equal(await getLikeRouteResponse({ method: "POST", origin: "https://wrong.example" }).status, 403);
assert.equal(await getLikeRouteResponse({ method: "POST", rateLimited: true }).status, 429);
assert.equal(await getLikeRouteResponse({ method: "POST", limiterUnavailable: true }).status, 503);
\`\`\`

- [ ] **Step 2: Run the test to prove the adapter is missing**

Run: \`npx tsx tests/site-likes.ts\`

Expected: export or module failure for the endpoint adapter.

- [ ] **Step 3: Implement GET and POST**

\`\`\`ts
const visitorCookieName = "site_like_visitor";

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return Boolean(origin && host && new URL(origin).host === host);
}
\`\`\`

Use \`cookies()\` to obtain or create a \`crypto.randomUUID()\` visitor ID. Set the cookie with \`httpOnly: true\`, \`secure: true\`, \`sameSite: "lax"\`, \`path: "/"\`, and a one-year \`maxAge\`. Hash the identifier before passing it to the service. Use the first \`x-forwarded-for\` entry as a Vercel-derived IP limiter key. Return 403 for missing or mismatched origins, 429 for \`LikeRateLimitError\`, and 503 for unavailable limiter credentials. Never return the cookie, hash, IP, or limiter details.

- [ ] **Step 4: Document required deployment variables**

\`\`\`dotenv
UPSTASH_REDIS_REST_URL="https://your-redis-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="replace-with-upstash-rest-token"
\`\`\`

Add these to \`.env.example\`, and state that they must be configured for Development, Preview, and Production in Vercel.

- [ ] **Step 5: Verify route contracts**

Run: \`npx tsx tests/site-likes.ts\`

Expected: GET issues an opaque cookie; cross-origin POST returns 403; limited POST returns 429; absent production limiter returns 503; successful duplicate POST retains the prior count.

- [ ] **Step 6: Commit the route**

\`\`\`bash
git add src/app/api/likes/route.ts .env.example tests/site-likes.ts
git commit -m "feat: expose protected like API"
\`\`\`

### Task 3: Workbench Heart Control

**Files:**
- Modify: \`src/components/profile-form/candidate-profile-workspace.tsx\`
- Modify: \`tests/site-likes.ts\`

**Interfaces:**
- Consumes Task 2's GET and POST JSON shapes.
- Produces an accessible heart button with stable count and server-confirmed liked state.

- [ ] **Step 1: Write failing client-state tests**

\`\`\`ts
assert.deepEqual(reduceLikeState(initialLikeState, { type: "loaded", count: 276, liked: false }), {
  count: 276, liked: false, status: "ready",
});
assert.deepEqual(reduceLikeState({ count: 276, liked: false, status: "ready" }, { type: "liked", count: 277 }), {
  count: 277, liked: true, status: "ready",
});
\`\`\`

- [ ] **Step 2: Run the test to prove the reducer is absent**

Run: \`npx tsx tests/site-likes.ts\`

Expected: export failure for \`reduceLikeState\`.

- [ ] **Step 3: Implement the UI state and button**

\`\`\`tsx
const [likeState, dispatchLike] = useReducer(reduceLikeState, initialLikeState);

useEffect(() => {
  void fetch("/api/likes", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then(({ count, liked }) => dispatchLike({ type: "loaded", count, liked }))
    .catch(() => dispatchLike({ type: "failed" }));
}, []);
\`\`\`

On click, send \`POST /api/likes\` with \`credentials: "same-origin"\`, disable the control while pending, and apply the returned summary only on success. Keep the initial visible count at 276 if GET fails. Place the button beside the guide link. Use \`Heart\`, \`aria-pressed\`, a title, “点赞” / “已点赞” labels, and red fill only after a confirmed vote. No unlike endpoint is exposed.

- [ ] **Step 4: Verify the UI state and lint**

Run: \`npx tsx tests/site-likes.ts; npm run lint\`

Expected: reducer transition tests and lint exit 0.

- [ ] **Step 5: Commit the heart control**

\`\`\`bash
git add src/components/profile-form/candidate-profile-workspace.tsx tests/site-likes.ts
git commit -m "feat: add site like control"
\`\`\`

### Task 4: Configure, Verify, and Publish

**Files:**
- Modify: \`docs/superpowers/specs/2026-08-26-like-button-design.md\` only if final API shapes differ.

**Interfaces:**
- Consumes Tasks 1-3.
- Produces a Vercel deployment with persisted GET results and protected POST results.

- [ ] **Step 1: Run complete local checks**

Run: \`npx tsx tests/site-likes.ts; npm run db:validate; npm run lint; npm run build\`

Expected: every command exits 0 and the production build recognizes \`/api/likes\`.

- [ ] **Step 2: Check production prerequisites**

Run: \`vercel env ls\`

Expected: \`DATABASE_URL\`, \`UPSTASH_REDIS_REST_URL\`, and \`UPSTASH_REDIS_REST_TOKEN\` exist for the Vercel project. Add any missing value with \`vercel env add\`; do not deploy protected POST writes without both Upstash variables.

- [ ] **Step 3: Apply the production migration**

Run: \`DATABASE_URL="<Neon direct connection string>" npm run db:deploy\`

Expected: one \`site_reaction\` row exists with 276 unless the database already has accepted votes.

- [ ] **Step 4: Deploy and smoke test**

Run: \`vercel --prod\`

Expected: Vercel returns the production URL. Run \`curl -i <deployment-url>/api/likes\` and confirm HTTP 200, an opaque \`Set-Cookie\`, numeric \`count\`, and boolean \`liked\`.

- [ ] **Step 5: Push the verified branch and open a draft PR**

\`\`\`bash
git push -u origin codex/add-like-button
gh pr create --draft --title "[codex] add protected site likes" --body-file <prepared-pr-body.md>
\`\`\`

The PR body must state the initial count, anonymous-cookie limitation, Upstash requirements, migration, and verification commands.

- [ ] **Step 6: Confirm the final tree**

Run: \`git status --short; git diff --check\`

Expected: no unstaged source changes; documentation changes, if any, are committed and pushed.
