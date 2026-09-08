import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { prisma } from "@/lib/db/prisma";

export const SITE_LIKE_KEY = "site";
export const SITE_LIKE_INITIAL_COUNT = 276;

export type LikeSummary = {
  count: number;
  liked: boolean;
};

export type LikeUiStatus = "loading" | "ready" | "pending" | "failed";

export type LikeUiState = {
  count: number;
  liked: boolean;
  status: LikeUiStatus;
  message: string | null;
};

export type LikeUiEvent =
  | { type: "loaded"; count: number; liked: boolean }
  | { type: "submit" }
  | { type: "liked"; count: number }
  | { type: "failed"; message?: string };

export const initialLikeState: LikeUiState = {
  count: SITE_LIKE_INITIAL_COUNT,
  liked: false,
  status: "loading",
  message: null,
};

export function reduceLikeState(state: LikeUiState, event: LikeUiEvent): LikeUiState {
  switch (event.type) {
    case "loaded":
      return {
        count: event.count,
        liked: event.liked,
        status: "ready",
        message: null,
      };
    case "submit":
      if (state.liked || state.status === "pending") return state;
      return { ...state, status: "pending", message: null };
    case "liked":
      return {
        count: event.count,
        liked: true,
        status: "ready",
        message: null,
      };
    case "failed":
      return {
        ...state,
        status: state.liked ? "ready" : "failed",
        message: event.message ?? "点赞失败，请稍后重试",
      };
    default:
      return state;
  }
}

export type LikeLimiter = {
  limit(key: string): Promise<{ success: boolean }>;
};

export type LikeRepository = {
  transaction<T>(work: (repository: LikeRepository) => Promise<T>): Promise<T>;
  findReaction(): Promise<{ count: number }>;
  findVote(reactionKey: string, visitorHash: string): Promise<boolean>;
  createVote(reactionKey: string, visitorHash: string): Promise<void>;
  incrementReaction(): Promise<{ count: number }>;
};

export class LikeRateLimitError extends Error {
  constructor() {
    super("LIKE_RATE_LIMITED");
    this.name = "LikeRateLimitError";
  }
}

export class LikeRateLimitUnavailableError extends Error {
  constructor() {
    super("LIKE_RATE_LIMIT_UNAVAILABLE");
    this.name = "LikeRateLimitUnavailableError";
  }
}

export function hashVisitorId(visitorId: string) {
  return createHash("sha256").update(visitorId).digest("hex");
}

function isDuplicateVoteError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export function createSiteLikeService(repository: LikeRepository, limiter: LikeLimiter) {
  async function getSummary(visitorHash: string): Promise<LikeSummary> {
    const [reaction, liked] = await Promise.all([
      repository.findReaction(),
      repository.findVote(SITE_LIKE_KEY, visitorHash),
    ]);
    return { count: reaction.count, liked };
  }

  async function enforceRateLimits(keys: string[]) {
    const results = await Promise.all(keys.filter(Boolean).map((key) => limiter.limit(key)));
    if (results.some((result) => !result.success)) throw new LikeRateLimitError();
  }

  return {
    getSummary,
    async record(input: { visitorHash: string; rateLimitKeys: string[] }) {
      await enforceRateLimits(input.rateLimitKeys);

      return repository.transaction(async (transactionRepository) => {
        if (await transactionRepository.findVote(SITE_LIKE_KEY, input.visitorHash)) {
          return { kind: "already_liked" as const, summary: await getSummary(input.visitorHash) };
        }

        try {
          await transactionRepository.createVote(SITE_LIKE_KEY, input.visitorHash);
        } catch (error) {
          if (!isDuplicateVoteError(error)) throw error;
          return { kind: "already_liked" as const, summary: await getSummary(input.visitorHash) };
        }

        const reaction = await transactionRepository.incrementReaction();
        return { kind: "counted" as const, summary: { count: reaction.count, liked: true } };
      });
    },
  };
}

const productionLimiter =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        }),
        limiter: Ratelimit.slidingWindow(5, "1 m"),
        prefix: "wan-zhiyuan:likes",
      })
    : null;

const productionRepository: LikeRepository = {
  transaction: (work) => prisma.$transaction((tx) => work(createPrismaRepository(tx))),
  async findReaction() {
    const reaction = await prisma.siteReaction.findUnique({ where: { key: SITE_LIKE_KEY } });
    return reaction ?? { count: SITE_LIKE_INITIAL_COUNT };
  },
  async findVote(reactionKey, visitorHash) {
    return Boolean(
      await prisma.siteReactionVote.findUnique({ where: { reactionKey_visitorHash: { reactionKey, visitorHash } } }),
    );
  },
  async createVote(reactionKey, visitorHash) {
    await prisma.siteReactionVote.create({ data: { reactionKey, visitorHash } });
  },
  async incrementReaction() {
    return prisma.siteReaction.update({ where: { key: SITE_LIKE_KEY }, data: { count: { increment: 1 } } });
  },
};

type PrismaSiteLikeClient = Pick<typeof prisma, "siteReaction" | "siteReactionVote">;

function createPrismaRepository(client: PrismaSiteLikeClient): LikeRepository {
  return {
    transaction: async (work) => work(createPrismaRepository(client)),
    async findReaction() {
      const reaction = await client.siteReaction.findUnique({ where: { key: SITE_LIKE_KEY } });
      return reaction ?? { count: SITE_LIKE_INITIAL_COUNT };
    },
    async findVote(reactionKey, visitorHash) {
      return Boolean(
        await client.siteReactionVote.findUnique({ where: { reactionKey_visitorHash: { reactionKey, visitorHash } } }),
      );
    },
    async createVote(reactionKey, visitorHash) {
      await client.siteReactionVote.create({ data: { reactionKey, visitorHash } });
    },
    async incrementReaction() {
      return client.siteReaction.update({ where: { key: SITE_LIKE_KEY }, data: { count: { increment: 1 } } });
    },
  };
}

const unavailableLimiter: LikeLimiter = {
  async limit() {
    throw new LikeRateLimitUnavailableError();
  },
};

export const siteLikeService = createSiteLikeService(
  productionRepository,
  productionLimiter ?? unavailableLimiter,
);

export async function getSiteLikeSummary(visitorHash: string) {
  return siteLikeService.getSummary(visitorHash);
}

export async function recordSiteLike(input: { visitorHash: string; rateLimitKeys: string[] }) {
  return siteLikeService.record(input);
}
