import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ClinicalSpecialty } from "@med/shared";
import type { CaseStatus, Difficulty } from "@med/shared";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class QueryCasesDto {
  @ApiPropertyOptional({ enum: ClinicalSpecialty })
  @IsOptional()
  @IsEnum(ClinicalSpecialty)
  specialty?: ClinicalSpecialty;

  @ApiPropertyOptional({ enum: DIFFICULTIES })
  @IsOptional()
  @IsEnum(DIFFICULTIES)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: CaseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}
