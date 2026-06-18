import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { AdminUsersService } from "./admin-users.service";
import { AdminCreateUserDto, AdminListUsersDto, AdminUpdateUserDto } from "./dto/admin.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("admin")
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: "List users (filter by role/status/search, paginated)" })
  list(@Query() query: AdminListUsersDto) {
    return this.users.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a user" })
  getOne(@Param("id") id: string) {
    return this.users.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a user with any role" })
  create(@Body() dto: AdminCreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a user (profile, role, active state)" })
  update(@Param("id") id: string, @Body() dto: AdminUpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.update(id, dto, user.id);
  }

  @Post(":id/block")
  @ApiOperation({ summary: "Block a user (revokes active sessions)" })
  block(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.setActive(id, false, user.id);
  }

  @Post(":id/unblock")
  @ApiOperation({ summary: "Unblock a user" })
  unblock(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.setActive(id, true, user.id);
  }
}
