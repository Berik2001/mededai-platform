import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { TestsService } from "./tests.service";
import { TestSessionsService } from "./test-sessions.service";
import { CreateTestDto, QueryTestsDto, UpdateTestDto } from "./dto/tests.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("tests")
@ApiBearerAuth()
@Controller("tests")
export class TestsController {
  constructor(
    private readonly tests: TestsService,
    private readonly sessions: TestSessionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List tests (role-scoped)" })
  findAll(@Query() query: QueryTestsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tests.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a test (detail for author/admin, metadata otherwise)" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tests.findOne(id, user);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Create a test" })
  create(@Body() dto: CreateTestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tests.create(dto, user);
  }

  @Patch(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Update a test" })
  update(@Param("id") id: string, @Body() dto: UpdateTestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tests.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Delete a test" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tests.remove(id, user);
  }

  @Post(":id/sessions")
  @ApiOperation({ summary: "Start a timed test session" })
  start(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.start(id, user);
  }
}
