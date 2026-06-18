import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ClinicalSpecialty } from "@med/shared";
import type { CaseStatus, Difficulty } from "@med/shared";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class CreateTestDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;

  @ApiProperty({ enum: ClinicalSpecialty })
  @IsEnum(ClinicalSpecialty)
  specialty!: ClinicalSpecialty;

  @ApiProperty({ enum: DIFFICULTIES })
  @IsEnum(DIFFICULTIES)
  difficulty!: Difficulty;

  @ApiPropertyOptional({ enum: STATUSES, default: "DRAFT" })
  @IsOptional() @IsEnum(STATUSES)
  status?: CaseStatus;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(600)
  timeLimitMinutes?: number;

  @ApiPropertyOptional({ default: 60, description: "Pass threshold (percent)." })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  shuffle?: boolean;

  @ApiProperty({ type: [String], description: "Ordered question ids." })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds!: string[];
}

export class UpdateTestDto extends PartialType(CreateTestDto) {}

export class QueryTestsDto {
  @ApiPropertyOptional({ enum: ClinicalSpecialty })
  @IsOptional() @IsEnum(ClinicalSpecialty)
  specialty?: ClinicalSpecialty;

  @ApiPropertyOptional({ enum: DIFFICULTIES })
  @IsOptional() @IsEnum(DIFFICULTIES)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional() @IsEnum(STATUSES)
  status?: CaseStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 20;
}
