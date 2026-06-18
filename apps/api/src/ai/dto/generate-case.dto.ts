import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { Difficulty, MedicalSpecialty } from "@med/shared";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const SPECIALTIES = [
  "CARDIOLOGY",
  "NEUROLOGY",
  "PEDIATRICS",
  "ONCOLOGY",
  "EMERGENCY",
  "INTERNAL_MEDICINE",
  "SURGERY",
  "PSYCHIATRY",
  "OTHER",
] as const;

export class GenerateCaseDto {
  @ApiProperty({ enum: SPECIALTIES })
  @IsEnum(SPECIALTIES)
  specialty!: MedicalSpecialty;

  @ApiProperty({ enum: DIFFICULTIES })
  @IsEnum(DIFFICULTIES)
  difficulty!: Difficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  numQuestions?: number = 3;
}
