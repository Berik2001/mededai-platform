import { Body, Controller, Get, Param, Post, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { OsceSessionsService } from "./osce-sessions.service";
import { CreateOsceSessionDto, OsceCheckDto, OsceAiGradeDto, OsceChatDto } from "./dto/osce.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("osce")
@ApiBearerAuth()
@Controller("osce/sessions")
export class OsceSessionsController {
  constructor(private readonly sessions: OsceSessionsService) {}

  @Get()
  @ApiOperation({ summary: "List OSCE sessions (mine as examiner/student; all for admin)" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.list(user);
  }

  @Post()
  @Roles(Role.EXAMINER, Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Schedule a session: an examiner observes a student" })
  create(@Body() dto: CreateOsceSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.create(dto, user);
  }

  @Get(":id")
  @Roles(Role.EXAMINER, Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Examiner conduct view (checklist + timer + hidden truth)" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.findOne(id, user);
  }

  @Get(":id/live")
  @ApiOperation({ summary: "Student live view: current station task + timer" })
  live(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.live(id, user);
  }

  @Get(":id/debrief")
  @ApiOperation({ summary: "Post-exam debrief (errors, missed diagnoses, pathway, recommendations)" })
  debrief(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.debrief(id, user);
  }

  // ─── Self-conduct (student-driven, AI patient) ───

  @Get(":id/self")
  @Roles(Role.STUDENT, Role.ADMIN)
  @ApiOperation({ summary: "Student self-conduct view: stations + AI-patient chat, no hidden truth" })
  self(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.self(id, user);
  }

  @Post(":id/self/start")
  @Roles(Role.STUDENT, Role.ADMIN)
  @ApiOperation({ summary: "Student starts their self-conducted exam (opens first station)" })
  selfStart(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.selfStart(id, user);
  }

  @Post(":id/self/stations/:stationId/chat")
  @Roles(Role.STUDENT, Role.ADMIN)
  @ApiOperation({ summary: "Student sends a line to the AI patient on the active station" })
  selfChat(
    @Param("id") id: string,
    @Param("stationId") stationId: string,
    @Body() dto: OsceChatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.selfChat(id, stationId, dto.message, user);
  }

  @Post(":id/self/stations/:stationId/finish")
  @Roles(Role.STUDENT, Role.ADMIN)
  @ApiOperation({ summary: "Finish the active station (manual/timer): AI grades + auto-advance" })
  selfFinish(
    @Param("id") id: string,
    @Param("stationId") stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.selfFinish(id, stationId, user);
  }

  @Post(":id/stations/:stationId/start")
  @Roles(Role.EXAMINER, Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Start a station's timer" })
  startStation(
    @Param("id") id: string,
    @Param("stationId") stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.startStation(id, stationId, user);
  }

  @Patch(":id/stations/:stationId/check")
  @Roles(Role.EXAMINER, Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Tick/untick checklist items + examiner comment" })
  check(
    @Param("id") id: string,
    @Param("stationId") stationId: string,
    @Body() dto: OsceCheckDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.check(id, stationId, dto, user);
  }

  @Patch(":id/stations/:stationId/ai-grade")
  @Roles(Role.EXAMINER, Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "AI auto-grades the hidden checklist from the student's actions" })
  aiGrade(
    @Param("id") id: string,
    @Param("stationId") stationId: string,
    @Body() dto: OsceAiGradeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.aiGrade(id, stationId, dto.transcript, user);
  }

  @Post(":id/stations/:stationId/end")
  @Roles(Role.EXAMINER, Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "End a station and finalise its score" })
  endStation(
    @Param("id") id: string,
    @Param("stationId") stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.endStation(id, stationId, user);
  }

  @Post(":id/complete")
  @Roles(Role.EXAMINER, Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Complete the exam: score all stations + AI debrief" })
  complete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.complete(id, user);
  }
}
