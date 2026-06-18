import { Controller, Get, Header, NotFoundException, Param, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Role } from "@med/shared";
import { AnalyticsService } from "./analytics.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("analytics")
@ApiBearerAuth()
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("me")
  @ApiOperation({ summary: "The current user's personal analytics" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.forSelf(user);
  }

  @Get("overview")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Cohort analytics (all students or a group)" })
  @ApiQuery({ name: "groupId", required: false })
  overview(@CurrentUser() user: AuthenticatedUser, @Query("groupId") groupId?: string) {
    return this.analytics.overview(user, groupId || undefined);
  }

  @Get("export")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Export a CSV report (scope=group|student)" })
  @ApiQuery({ name: "scope", enum: ["group", "student"] })
  @ApiQuery({ name: "studentId", required: false })
  @ApiQuery({ name: "groupId", required: false })
  @Header("Content-Type", "text/csv; charset=utf-8")
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
    @Query("scope") scope: string,
    @Query("studentId") studentId?: string,
    @Query("groupId") groupId?: string,
  ): Promise<string> {
    const report =
      scope === "student"
        ? await this.analytics.exportStudentCsv(this.required(studentId, "studentId"), user)
        : await this.analytics.exportGroupCsv(user, groupId || undefined);
    res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
    return report.csv;
  }

  @Get("students/:id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Analytics drill-down for a specific student" })
  student(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.forStudent(id, user);
  }

  private required(value: string | undefined, name: string): string {
    if (!value) throw new NotFoundException(`${name} is required`);
    return value;
  }
}
