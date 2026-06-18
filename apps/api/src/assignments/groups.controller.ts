import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { GroupsService } from "./groups.service";
import { AddMembersDto, CreateGroupDto, UpdateGroupDto } from "./dto/assignments.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("groups")
@ApiBearerAuth()
@Roles(Role.TEACHER, Role.ADMIN)
@Controller("groups")
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @ApiOperation({ summary: "List my groups" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.groups.list(user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a group with members" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.groups.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: "Create a group" })
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.groups.create(dto, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename a group" })
  rename(@Param("id") id: string, @Body() dto: UpdateGroupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.groups.updateName(id, dto, user);
  }

  @Post(":id/members")
  @ApiOperation({ summary: "Add members to a group" })
  addMembers(@Param("id") id: string, @Body() dto: AddMembersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.groups.addMembers(id, dto, user);
  }

  @Delete(":id/members/:userId")
  @ApiOperation({ summary: "Remove a member from a group" })
  removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groups.removeMember(id, userId, user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a group" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.groups.remove(id, user);
  }
}
