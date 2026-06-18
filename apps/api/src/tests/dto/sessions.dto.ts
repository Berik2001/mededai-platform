import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

/** Answers map: { [questionId]: number[] } of selected option indices. */
export class AnswersDto {
  @ApiProperty({ type: Object, example: { q1: [0], q2: [1, 3] } })
  @IsObject()
  answers!: Record<string, number[]>;
}
