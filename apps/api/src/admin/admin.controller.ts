import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ModerationType, Role } from "@med/shared";
import { AdminStatsService } from "./admin-stats.service";
import { AdminModerationService } from "./admin-moderation.service";
import { BackupService } from "../backup/backup.service";
import { ModerationDecisionDto, ModerationQueryDto } from "./dto/admin.dto";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("admin")
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly stats: AdminStatsService,
    private readonly moderation: AdminModerationService,
    private readonly backups: BackupService,
  ) {}

  // ─── Statistics ───
  @Get("stats")
  @ApiOperation({ summary: "System-wide statistics" })
  systemStats() {
    return this.stats.system();
  }

  // ─── Moderation ───
  @Get("moderation")
  @ApiOperation({ summary: "Content awaiting moderation (cases & tests)" })
  moderationQueue(@Query() query: ModerationQueryDto) {
    return this.moderation.list(query);
  }

  @Post("moderation/:type/:id")
  @ApiOperation({ summary: "Approve / reject / unpublish a case or test" })
  moderate(
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() dto: ModerationDecisionDto,
  ) {
    return this.moderation.moderate(this.normalizeType(type), id, dto);
  }

  // ─── Backups ───
  @Get("backups")
  @ApiOperation({ summary: "Backup settings + existing dump files" })
  async backupStatus() {
    return { settings: this.backups.settings(), backups: await this.backups.listBackups() };
  }

  @Post("backups")
  @ApiOperation({ summary: "Run a database backup now" })
  async runBackup() {
    const file = await this.backups.runBackup();
    if (!file) throw new BadRequestException("Backup failed — check server logs and pg_dump availability");
    return { ok: true, file };
  }

  @Delete("backups/:filename")
  @ApiOperation({ summary: "Delete a backup file" })
  async deleteBackup(@Param("filename") filename: string) {
    await this.backups.deleteBackup(filename);
    return { deleted: true, filename };
  }

  private normalizeType(type: string): ModerationType {
    const t = type.toUpperCase().replace(/S$/, "");
    if (t === "CASE" || t === "TEST") return t;
    throw new BadRequestException("type must be 'case' or 'test'");
  }
}
