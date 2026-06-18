-- CreateEnum
CREATE TYPE "OsceSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OsceStationState" AS ENUM ('PENDING', 'ACTIVE', 'DONE');

-- CreateTable
CREATE TABLE "osce_exams" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "specialty" "Specialty" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "passScore" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "osce_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "osce_stations" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 300,
    "expectedDiagnosis" TEXT,
    "correctPathway" TEXT,
    "examinerBrief" TEXT,

    CONSTRAINT "osce_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "osce_checklist_items" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,

    CONSTRAINT "osce_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "osce_sessions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examinerId" TEXT NOT NULL,
    "status" "OsceSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "debrief" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "osce_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "osce_station_scores" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "state" "OsceStationState" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "criticalFailed" BOOLEAN NOT NULL DEFAULT false,
    "examinerComment" TEXT,
    "aiAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "osce_station_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "osce_check_results" (
    "id" TEXT NOT NULL,
    "stationScoreId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "osce_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "osce_exams_specialty_idx" ON "osce_exams"("specialty");

-- CreateIndex
CREATE INDEX "osce_exams_status_idx" ON "osce_exams"("status");

-- CreateIndex
CREATE INDEX "osce_exams_authorId_idx" ON "osce_exams"("authorId");

-- CreateIndex
CREATE INDEX "osce_stations_examId_idx" ON "osce_stations"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "osce_stations_examId_order_key" ON "osce_stations"("examId", "order");

-- CreateIndex
CREATE INDEX "osce_checklist_items_stationId_idx" ON "osce_checklist_items"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "osce_checklist_items_stationId_order_key" ON "osce_checklist_items"("stationId", "order");

-- CreateIndex
CREATE INDEX "osce_sessions_examId_idx" ON "osce_sessions"("examId");

-- CreateIndex
CREATE INDEX "osce_sessions_studentId_idx" ON "osce_sessions"("studentId");

-- CreateIndex
CREATE INDEX "osce_sessions_examinerId_idx" ON "osce_sessions"("examinerId");

-- CreateIndex
CREATE INDEX "osce_station_scores_sessionId_idx" ON "osce_station_scores"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "osce_station_scores_sessionId_stationId_key" ON "osce_station_scores"("sessionId", "stationId");

-- CreateIndex
CREATE INDEX "osce_check_results_stationScoreId_idx" ON "osce_check_results"("stationScoreId");

-- CreateIndex
CREATE UNIQUE INDEX "osce_check_results_stationScoreId_checklistItemId_key" ON "osce_check_results"("stationScoreId", "checklistItemId");

-- AddForeignKey
ALTER TABLE "osce_exams" ADD CONSTRAINT "osce_exams_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_stations" ADD CONSTRAINT "osce_stations_examId_fkey" FOREIGN KEY ("examId") REFERENCES "osce_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_checklist_items" ADD CONSTRAINT "osce_checklist_items_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "osce_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_sessions" ADD CONSTRAINT "osce_sessions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "osce_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_sessions" ADD CONSTRAINT "osce_sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_sessions" ADD CONSTRAINT "osce_sessions_examinerId_fkey" FOREIGN KEY ("examinerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_station_scores" ADD CONSTRAINT "osce_station_scores_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "osce_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_station_scores" ADD CONSTRAINT "osce_station_scores_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "osce_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_check_results" ADD CONSTRAINT "osce_check_results_stationScoreId_fkey" FOREIGN KEY ("stationScoreId") REFERENCES "osce_station_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osce_check_results" ADD CONSTRAINT "osce_check_results_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "osce_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
