import assert from "node:assert/strict";

import { handleLikeRequest } from "@/app/api/likes/route";
import {
  createSiteLikeService,
  hashVisitorId,
  initialLikeState,
  LikeRateLimitError,
  LikeRateLimitUnavailableError,
  reduceLikeState,
  type LikeRepository,
} from "@/lib/site-likes";

type Reaction = { count: number };

function createFakeRepository(): LikeRepository & { getVoteCount(): number } {
  const reaction: Reaction = { count: 276 };
  const votes = new Set<string>();
  let transaction: Promise<void> = Promise.resolve();

  const repository: LikeRepository & { getVoteCount(): number } = {
    transaction<T>(work: (transactionRepository: LikeRepository) => Promise<T>) {
      const run = transaction.then(() => work(this));
      transaction = run.then(() => undefined, () => undefined);
      return run;
    },
    async findReaction() {
      return { ...reaction };
    },
    async findVote(_reactionKey: string, visitorHash: string) {
      return votes.has(visitorHash);
    },
    async createVote(_reactionKey: string, visitorHash: string) {
      if (votes.has(visitorHash)) {
        const error = new Error("duplicate vote");
        Object.assign(error, { code: "P2002" });
        throw error;
      }
      votes.add(visitorHash);
    },
    async incrementReaction() {
      reaction.count += 1;
      return { ...reaction };
    },
    getVoteCount() {
      return votes.size;
    },
  };

  return repository;
}

function createAllowingLimiter() {
  return {
    async limit() {
      return { success: true };
    },
  };
}

function createRejectingLimiter() {
  return {
    async limit() {
      return { success: false };
    },
  };
}

async function getLikeRouteResponse(options: {
  method: "GET" | "POST";
  cookie?: string;
  origin?: string;
  rateLimited?: boolean;
  limiterUnavailable?: boolean;
  host?: string;
  repository?: LikeRepository;
}) {
  const repository = options.repository ?? createFakeRepository();
  const service = createSiteLikeService(
    repository,
    options.rateLimited
      ? createRejectingLimiter()
      : options.limiterUnavailable
        ? {
            async limit() {
              throw new LikeRateLimitUnavailableError();
            },
          }
        : createAllowingLimiter(),
  );

  const headers = new Headers();
  headers.set("host", options.host ?? "example.com");
  if (options.origin) headers.set("origin", options.origin);
  if (options.cookie) headers.set("cookie", `${"site_like_visitor"}=${options.cookie}`);

  return handleLikeRequest(new Request("https://example.com/api/likes", {
    method: options.method,
    headers,
  }), {
    getSummary: (visitorHash) => service.getSummary(visitorHash),
    record: (input) => service.record(input),
    createVisitorId: () => "visitor-test",
    readVisitorCookie: () => options.cookie,
  });
}

(async () => {
  const repository = createFakeRepository();
  const service = createSiteLikeService(repository, createAllowingLimiter());
  const first = await service.record({ visitorHash: "visitor-a", rateLimitKeys: ["visitor-a", "ip-a"] });
  assert.deepEqual(first, { kind: "counted", summary: { count: 277, liked: true } });

  const duplicate = await service.record({ visitorHash: "visitor-a", rateLimitKeys: ["visitor-a", "ip-a"] });
  assert.deepEqual(duplicate, { kind: "already_liked", summary: { count: 277, liked: true } });

  const separateVisitor = await service.record({ visitorHash: "visitor-b", rateLimitKeys: ["visitor-b", "ip-a"] });
  assert.deepEqual(separateVisitor, { kind: "counted", summary: { count: 278, liked: true } });

  const limitedRepository = createFakeRepository();
  const limitedService = createSiteLikeService(limitedRepository, createRejectingLimiter());
  await assert.rejects(
    () => limitedService.record({ visitorHash: "visitor-c", rateLimitKeys: ["visitor-c", "ip-a"] }),
    LikeRateLimitError,
  );
  assert.equal(limitedRepository.getVoteCount(), 0);
  assert.deepEqual(await limitedService.getSummary("visitor-c"), { count: 276, liked: false });

  assert.equal(
    hashVisitorId("visitor-a"),
    "0de4b4ec57b51b438680498a1e9f86882eac5336b349354340de21bc69dcb35d",
  );

  const getResponse = await getLikeRouteResponse({ method: "GET" });
  assert.equal(getResponse.status, 200);
  assert.match(getResponse.headers.get("set-cookie") ?? "", /site_like_visitor=/);
  assert.deepEqual(await getResponse.json(), { count: 276, liked: false });

  assert.equal(
    (await getLikeRouteResponse({ method: "POST", origin: "https://wrong.example" })).status,
    403,
  );
  assert.equal(
    (await getLikeRouteResponse({ method: "POST", origin: "https://example.com", rateLimited: true })).status,
    429,
  );
  assert.equal(
    (
      await getLikeRouteResponse({
        method: "POST",
        origin: "https://example.com",
        limiterUnavailable: true,
      })
    ).status,
    503,
  );

  const sharedRepository = createFakeRepository();
  const firstSharedPost = await getLikeRouteResponse({
    method: "POST",
    origin: "https://example.com",
    cookie: "visitor-a",
    repository: sharedRepository,
  });
  assert.equal(firstSharedPost.status, 200);
  assert.deepEqual(await firstSharedPost.json(), { count: 277, liked: true });

  const duplicatePost = await getLikeRouteResponse({
    method: "POST",
    origin: "https://example.com",
    cookie: "visitor-a",
    repository: sharedRepository,
  });
  assert.equal(duplicatePost.status, 200);
  assert.deepEqual(await duplicatePost.json(), { count: 277, liked: true });

  assert.deepEqual(reduceLikeState(initialLikeState, { type: "loaded", count: 276, liked: false }), {
    count: 276,
    liked: false,
    status: "ready",
    message: null,
  });
  assert.deepEqual(reduceLikeState({ count: 276, liked: false, status: "ready", message: null }, { type: "liked", count: 277 }), {
    count: 277,
    liked: true,
    status: "ready",
    message: null,
  });

  console.log("Site likes service OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
