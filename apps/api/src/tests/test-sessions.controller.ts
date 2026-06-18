import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { TestSessionsService } from "./test-sessions.service";
import { AnswersDto } from "./dto/sessions.dto";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("test-sessions")
@ApiBearerAuth()
@Controller("test-sessions")
export class TestSessionsController {
  constructor(private readonly sessions: TestSessionsService) {}

  @Get()
  @ApiOperation({ summary: "My test session history" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.list(user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a session (resume in progress, or view graded result)" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.findOne(id, user);
  }

  @Patch(":id/answers")
  @ApiOperation({ summary: "Autosave answers while the test is in progress" })
  save(@Param("id") id: string, @Body() dto: AnswersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.saveAnswers(id, user, dto.answers);
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Submit and auto-grade the test" })
  submit(@Param("id") id: string, @Body() dto: AnswersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.submit(id, user, dto.answers);
  }
}
