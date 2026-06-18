-- AlterTable
ALTER TABLE "osce_sessions" ADD COLUMN     "selfConduct" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "osce_station_scores" ADD COLUMN     "chat" JSONB;
