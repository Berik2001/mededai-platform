import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { VirtualPatientModule } from "../virtual-patient/virtual-patient.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsAggregatorService } from "./analytics-aggregator.service";
import { ErrorClassifierService } from "./error-classifier.service";
import { RecommendationService } from "./recommendation.service";

@Module({
  imports: [
    AiModule, // GeminiService for NLP classification + recommendations
    VirtualPatientModule, // VirtualPatientService.analyticsForUser
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsAggregatorService,
    ErrorClassifierService,
    RecommendationService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
