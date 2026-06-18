import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { QuestionsService } from "./questions.service";
import { CreateQuestionDto, QueryQuestionsDto, UpdateQuestionDto } from "./dto/questions.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

// The question bank exposes answer keys → staff-only.
@ApiTags("questions")
@ApiBearerAuth()
@Roles(Role.TEACHER, Role.ADMIN)
@Controller("questions")
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: "List questions (own for teachers, all for admin)" })
  findAll(@Query() query: QueryQuestionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.questions.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a question with its answer key" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.questions.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: "Create a question" })
  create(@Body() dto: CreateQuestionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.questions.create(dto, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a question" })
  update(@Param("id") id: string, @Body() dto: UpdateQuestionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.questions.update(id, dto, user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a question" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.questions.remove(id, user);
  }
}
