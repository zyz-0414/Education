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

INSERT INTO "site_reaction" ("key", "count", "updatedAt")
VALUES ('site', 276, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
