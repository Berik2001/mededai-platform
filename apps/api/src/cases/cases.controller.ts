import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { CasesService } from "./cases.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";
import { QueryCasesDto } from "./dto/query-cases.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("cases")
@ApiBearerAuth()
@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  @ApiOperation({ summary: "List clinical cases (filtered, paginated, role-scoped)" })
  findAll(@Query() query: QueryCasesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a clinical case (full for author/admin, redacted otherwise)" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.findOne(id, user);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Create a clinical case (teacher/admin)" })
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.create(dto, user);
  }

  @Patch(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Update a clinical case (author or admin)" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Delete a clinical case (author or admin)" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.remove(id, user);
  }

  @Post(":id/launch")
  @HttpCode(201)
  @ApiOperation({ summary: "Launch a Virtual Patient session seeded from this case" })
  launch(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.launch(id, user);
  }
}
