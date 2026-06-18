import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ClinicalSpecialty } from "@med/shared";
import type { CaseStatus, Difficulty } from "@med/shared";
import { CaseContentDto } from "./case-content.dto";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class CreateCaseDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title!: string;

  @ApiProperty({ enum: ClinicalSpecialty })
  @IsEnum(ClinicalSpecialty)
  specialty!: ClinicalSpecialty;

  @ApiProperty({ enum: DIFFICULTIES })
  @IsEnum(DIFFICULTIES)
  difficulty!: Difficulty;

  @ApiPropertyOptional({ enum: STATUSES, default: "DRAFT" })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: CaseStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500) summary?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1) estimatedMinutes?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() tags?: string[];

  @ApiProperty({ type: CaseContentDto })
  @ValidateNested()
  @Type(() => CaseContentDto)
  content!: CaseContentDto;
}
