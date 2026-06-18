import { Module } from "@nestjs/common";
import { VirtualPatientModule } from "../virtual-patient/virtual-patient.module";
import { BackupModule } from "../backup/backup.module";
import { AdminController } from "./admin.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminStatsService } from "./admin-stats.service";
import { AdminModerationService } from "./admin-moderation.service";

@Module({
  imports: [
    VirtualPatientModule, // VirtualPatientService.sessionStats (Mongo counts)
    BackupModule, // BackupService for backup management
  ],
  controllers: [AdminController, AdminUsersController],
  providers: [AdminUsersService, AdminStatsService, AdminModerationService],
})
export class AdminModule {}
