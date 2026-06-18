import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { AssignmentsService } from "./assignments.service";
import { SubmissionsService } from "./submissions.service";
import { CreateAssignmentDto, ReviewSubmissionDto, UpdateAssignmentDto } from "./dto/assignments.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("assignments")
@ApiBearerAuth()
@Controller("assignments")
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly submissions: SubmissionsService,
  ) {}

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "List assignments I created" })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.assignments.findAll(user);
  }

  @Get(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Assignment detail with per-student submissions" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.findOne(id, user);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Create an assignment (targets students and/or groups)" })
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.create(dto, user);
  }

  @Patch(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Update an assignment (title/instructions/deadline)" })
  update(@Param("id") id: string, @Body() dto: UpdateAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Delete an assignment" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.remove(id, user);
  }

  @Post("submissions/:submissionId/review")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Review a submission: grade + feedback" })
  review(
    @Param("submissionId") submissionId: string,
    @Body() dto: ReviewSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissions.review(submissionId, dto, user);
  }
}
