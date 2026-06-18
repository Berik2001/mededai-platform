import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "List all users (admin only)" })
  findAll() {
    return this.usersService.findAll();
  }

  @Get("me")
  @ApiOperation({ summary: "Get the current user's full profile" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update the current user's profile" })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get("students")
  @Roles(Role.ADMIN, Role.TEACHER, Role.EXAMINER)
  @ApiOperation({ summary: "List active students (for groups/assignments/OSCE)" })
  students() {
    return this.usersService.findStudents();
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: "Get a user by id (staff only)" })
  findOne(@Param("id") id: string) {
    return this.usersService.findById(id);
  }
}
