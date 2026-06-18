import { Module } from "@nestjs/common";
import { QuestionsService } from "./questions.service";
import { QuestionsController } from "./questions.controller";
import { TestsService } from "./tests.service";
import { TestsController } from "./tests.controller";
import { TestSessionsService } from "./test-sessions.service";
import { TestSessionsController } from "./test-sessions.controller";
import { UploadsController } from "./uploads.controller";

@Module({
  controllers: [
    QuestionsController,
    TestsController,
    TestSessionsController,
    UploadsController,
  ],
  providers: [QuestionsService, TestsService, TestSessionsService],
  exports: [QuestionsService, TestsService, TestSessionsService],
})
export class TestsModule {}
