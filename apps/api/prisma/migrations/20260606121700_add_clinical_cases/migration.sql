-- CreateEnum
CREATE TYPE "Specialty" AS ENUM ('THERAPY', 'SURGERY', 'CARDIOLOGY', 'NEUROLOGY', 'PEDIATRICS', 'CRITICAL_CARE', 'NURSING');

-- CreateEnum
CREATE TYPE "CaseDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "clinical_cases" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "specialty" "Specialty" NOT NULL,
    "difficulty" "CaseDifficulty" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "estimatedMinutes" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_cases_contentId_key" ON "clinical_cases"("contentId");

-- CreateIndex
CREATE INDEX "clinical_cases_specialty_idx" ON "clinical_cases"("specialty");

-- CreateIndex
CREATE INDEX "clinical_cases_status_idx" ON "clinical_cases"("status");

-- CreateIndex
CREATE INDEX "clinical_cases_authorId_idx" ON "clinical_cases"("authorId");

-- AddForeignKey
ALTER TABLE "clinical_cases" ADD CONSTRAINT "clinical_cases_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
