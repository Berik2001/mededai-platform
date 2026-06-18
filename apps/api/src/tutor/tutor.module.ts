import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { TutorController } from "./tutor.controller";
import { TutorService } from "./tutor.service";

@Module({
  imports: [
    AiModule, // GeminiService
    AnalyticsModule, // AnalyticsService for student context
  ],
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}
