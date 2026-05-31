-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "source" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "publisher" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3),
    "fileHash" TEXT,
    "parserVersion" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "province_policy" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "examMode" TEXT NOT NULL,
    "volunteerUnitType" TEXT NOT NULL,
    "maxVolunteers" INTEGER NOT NULL,
    "majorsPerGroup" INTEGER,
    "hasMajorAdjustment" BOOLEAN NOT NULL DEFAULT true,
    "policyJson" JSONB,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "province_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_segment" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "subjectTrack" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "cumulativeCount" INTEGER NOT NULL,
    "rankMin" INTEGER,
    "rankMax" INTEGER,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "score_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "college" (
    "id" TEXT NOT NULL,
    "collegeCode" TEXT NOT NULL,
    "collegeName" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "level" TEXT,
    "ownership" TEXT,
    "tags" JSONB,
    "officialSite" TEXT,
    "sourceId" TEXT,

    CONSTRAINT "college_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "major" (
    "id" TEXT NOT NULL,
    "majorCode" TEXT NOT NULL,
    "majorName" TEXT NOT NULL,
    "majorCategory" TEXT,
    "degreeCategory" TEXT,
    "duration" TEXT,
    "notes" TEXT,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "major_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "college_group" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "subjectTrack" TEXT NOT NULL,
    "collegeCode" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "subjectRequirement" TEXT NOT NULL,
    "groupNote" TEXT,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "college_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "major_plan" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "subjectTrack" TEXT NOT NULL,
    "collegeCode" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "majorCode" TEXT NOT NULL,
    "majorName" TEXT NOT NULL,
    "subjectRequirement" TEXT,
    "planCount" INTEGER NOT NULL,
    "tuition" INTEGER,
    "duration" TEXT,
    "campus" TEXT,
    "note" TEXT,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "major_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_result" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "subjectTrack" TEXT NOT NULL,
    "collegeCode" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "majorCode" TEXT,
    "minScore" INTEGER,
    "minRank" INTEGER,
    "avgScore" INTEGER,
    "avgRank" INTEGER,
    "maxScore" INTEGER,
    "maxRank" INTEGER,
    "admittedCount" INTEGER,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "admission_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charter_rule" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "collegeCode" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeCode" TEXT,
    "ruleType" TEXT NOT NULL,
    "conditionJson" JSONB,
    "originalText" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "charter_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_run" (
    "id" TEXT NOT NULL,
    "userProfileJson" JSONB NOT NULL,
    "dataVersion" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL DEFAULT 'balanced',
    "resultJson" JSONB NOT NULL,

    CONSTRAINT "recommendation_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "province_policy_year_provinceCode_batchCode_key" ON "province_policy"("year", "provinceCode", "batchCode");

-- CreateIndex
CREATE UNIQUE INDEX "score_segment_year_provinceCode_subjectTrack_score_key" ON "score_segment"("year", "provinceCode", "subjectTrack", "score");

-- CreateIndex
CREATE UNIQUE INDEX "college_collegeCode_key" ON "college"("collegeCode");

-- CreateIndex
CREATE INDEX "major_majorCode_majorName_idx" ON "major"("majorCode", "majorName");

-- CreateIndex
CREATE UNIQUE INDEX "major_majorCode_majorName_sourceId_key" ON "major"("majorCode", "majorName", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "college_group_year_provinceCode_batchCode_subjectTrack_coll_key" ON "college_group"("year", "provinceCode", "batchCode", "subjectTrack", "collegeCode", "groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "major_plan_year_provinceCode_batchCode_subjectTrack_college_key" ON "major_plan"("year", "provinceCode", "batchCode", "subjectTrack", "collegeCode", "groupCode", "majorCode");

-- CreateIndex
CREATE INDEX "admission_result_year_provinceCode_batchCode_subjectTrack_c_idx" ON "admission_result"("year", "provinceCode", "batchCode", "subjectTrack", "collegeCode", "groupCode");

-- CreateIndex
CREATE INDEX "charter_rule_year_collegeCode_ruleType_idx" ON "charter_rule"("year", "collegeCode", "ruleType");

-- AddForeignKey
ALTER TABLE "province_policy" ADD CONSTRAINT "province_policy_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_segment" ADD CONSTRAINT "score_segment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college" ADD CONSTRAINT "college_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major" ADD CONSTRAINT "major_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college_group" ADD CONSTRAINT "college_group_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college_group" ADD CONSTRAINT "college_group_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "college"("collegeCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_plan" ADD CONSTRAINT "major_plan_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_plan" ADD CONSTRAINT "major_plan_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "college"("collegeCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_plan" ADD CONSTRAINT "major_plan_year_provinceCode_batchCode_subjectTrack_colleg_fkey" FOREIGN KEY ("year", "provinceCode", "batchCode", "subjectTrack", "collegeCode", "groupCode") REFERENCES "college_group"("year", "provinceCode", "batchCode", "subjectTrack", "collegeCode", "groupCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_result" ADD CONSTRAINT "admission_result_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_result" ADD CONSTRAINT "admission_result_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "college"("collegeCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_result" ADD CONSTRAINT "admission_result_year_provinceCode_batchCode_subjectTrack__fkey" FOREIGN KEY ("year", "provinceCode", "batchCode", "subjectTrack", "collegeCode", "groupCode") REFERENCES "college_group"("year", "provinceCode", "batchCode", "subjectTrack", "collegeCode", "groupCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charter_rule" ADD CONSTRAINT "charter_rule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charter_rule" ADD CONSTRAINT "charter_rule_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "college"("collegeCode") ON DELETE RESTRICT ON UPDATE CASCADE;
