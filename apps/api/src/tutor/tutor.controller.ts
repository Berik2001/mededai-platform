import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { TutorService } from "./tutor.service";
import { TutorDto } from "../ai/dto/tutor.dto";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("tutor")
@ApiBearerAuth()
@Controller("tutor")
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Post("chat")
  @ApiOperation({ summary: "Socratic AI tutor grounded in the student's own progress" })
  chat(@Body() dto: TutorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tutor.chat(user, dto);
  }
}
