import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { AiService } from "./ai.service";
import { TutorDto } from "./dto/tutor.dto";
import { GenerateCaseDto } from "./dto/generate-case.dto";
import { EvaluateAnswerDto } from "./dto/evaluate-answer.dto";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("ai")
@ApiBearerAuth()
@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("tutor")
  @ApiOperation({ summary: "Socratic AI tutor conversation" })
  tutor(@Body() dto: TutorDto) {
    return this.aiService.tutor(dto);
  }

  @Post("generate-case")
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Generate a draft clinical case (staff only)" })
  generateCase(@Body() dto: GenerateCaseDto) {
    return this.aiService.generateCase(dto);
  }

  @Post("evaluate-answer")
  @ApiOperation({ summary: "Evaluate a learner's free-text answer" })
  evaluateAnswer(@Body() dto: EvaluateAnswerDto) {
    return this.aiService.evaluateAnswer(dto);
  }
}
