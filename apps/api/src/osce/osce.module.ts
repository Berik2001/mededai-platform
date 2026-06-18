import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { OsceService } from "./osce.service";
import { OsceController } from "./osce.controller";
import { OsceSessionsService } from "./osce-sessions.service";
import { OsceSessionsController } from "./osce-sessions.controller";
import { OsceAiService } from "./osce-ai.service";

@Module({
  imports: [AiModule], // GeminiService for debrief generation
  controllers: [OsceController, OsceSessionsController],
  providers: [OsceService, OsceSessionsService, OsceAiService],
  exports: [OsceService, OsceSessionsService],
})
export class OsceModule {}
