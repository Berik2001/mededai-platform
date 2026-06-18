import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SubmissionsService } from "./submissions.service";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("submissions")
@ApiBearerAuth()
@Controller("submissions")
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get("my")
  @ApiOperation({ summary: "My assigned tasks (student dashboard)" })
  myTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.submissions.myTasks(user);
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Submit a task (auto-attaches your latest completed result)" })
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.submissions.submit(id, user);
  }
}
