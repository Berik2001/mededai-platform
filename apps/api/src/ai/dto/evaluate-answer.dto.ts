import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class EvaluateAnswerDto {
  @ApiProperty()
  @IsString()
  caseId!: string;

  @ApiProperty()
  @IsString()
  questionPrompt!: string;

  @ApiProperty()
  @IsString()
  learnerAnswer!: string;
}
