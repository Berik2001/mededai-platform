import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { ClinicalSpecialty, QUESTION_TYPES } from "@med/shared";
import type { CaseStatus, Difficulty, QuestionType } from "@med/shared";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class CreateQuestionDto {
  @ApiProperty({ enum: QUESTION_TYPES })
  @IsEnum(QUESTION_TYPES as unknown as string[])
  type!: QuestionType;

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

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  stem!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  caseVignette?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options!: string[];

  @ApiProperty({ type: [Number], description: "Indices of correct option(s)." })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  correctOptions!: number[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  explanation?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  points?: number;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class QueryQuestionsDto {
  @ApiPropertyOptional({ enum: QUESTION_TYPES })
  @IsOptional()
  @IsEnum(QUESTION_TYPES as unknown as string[])
  type?: QuestionType;

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

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 50;
}
