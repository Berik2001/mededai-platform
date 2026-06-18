import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { OsceService } from "./osce.service";
import { CreateOsceExamDto, QueryOsceExamsDto, UpdateOsceExamDto } from "./dto/osce.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("osce")
@ApiBearerAuth()
@Controller("osce/exams")
export class OsceController {
  constructor(private readonly osce: OsceService) {}

  @Get()
  @ApiOperation({ summary: "List OSCE exams (role-scoped)" })
  findAll(@Query() query: QueryOsceExamsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.osce.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an OSCE exam (full for author/admin, safe view otherwise)" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.osce.findOne(id, user);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Create an OSCE exam (stations + checklists)" })
  create(@Body() dto: CreateOsceExamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.osce.create(dto, user);
  }

  @Patch(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Update an OSCE exam" })
  update(@Param("id") id: string, @Body() dto: UpdateOsceExamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.osce.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Delete an OSCE exam" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.osce.remove(id, user);
  }
}
