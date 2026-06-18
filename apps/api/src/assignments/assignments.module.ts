import { Module } from "@nestjs/common";
import { VirtualPatientModule } from "../virtual-patient/virtual-patient.module";
import { TestsModule } from "../tests/tests.module";
import { GroupsService } from "./groups.service";
import { GroupsController } from "./groups.controller";
import { AssignmentsService } from "./assignments.service";
import { AssignmentsController } from "./assignments.controller";
import { SubmissionsService } from "./submissions.service";
import { SubmissionsController } from "./submissions.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { DeadlineNotifierService } from "./deadline-notifier.service";

@Module({
  imports: [
    VirtualPatientModule, // VirtualPatientService.latestCaseResult
    TestsModule, // TestSessionsService.latestTestResult
  ],
  controllers: [
    GroupsController,
    AssignmentsController,
    SubmissionsController,
    NotificationsController,
  ],
  providers: [
    GroupsService,
    AssignmentsService,
    SubmissionsService,
    NotificationsService,
    DeadlineNotifierService,
  ],
})
export class AssignmentsModule {}
