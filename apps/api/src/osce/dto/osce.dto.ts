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
  MinLength,
  ValidateNested,
} from "class-validator";
import { ClinicalSpecialty } from "@med/shared";
import type { CaseStatus } from "@med/shared";

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class ChecklistItemDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) label!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  points?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  critical?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(80)
  category?: string;
}

export class OsceStationDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) title!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) scenario!: string;

  @ApiProperty({ default: 300, description: "Station duration in seconds." })
  @Type(() => Number) @IsInt() @Min(30) @Max(3600)
  durationSec!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) expectedDiagnosis?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) correctPathway?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) examinerBrief?: string;

  @ApiProperty({ type: [ChecklistItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist!: ChecklistItemDto[];
}

export class CreateOsceExamDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiProperty({ enum: ClinicalSpecialty })
  @IsEnum(ClinicalSpecialty)
  specialty!: ClinicalSpecialty;

  @ApiPropertyOptional({ enum: STATUSES, default: "DRAFT" })
  @IsOptional() @IsEnum(STATUSES)
  status?: CaseStatus;

  @ApiPropertyOptional({ default: 60, description: "Pass threshold (percent)." })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  passScore?: number;

  @ApiProperty({ type: [OsceStationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OsceStationDto)
  stations!: OsceStationDto[];
}

export class UpdateOsceExamDto extends PartialType(CreateOsceExamDto) {}

export class QueryOsceExamsDto {
  @ApiPropertyOptional({ enum: ClinicalSpecialty })
  @IsOptional() @IsEnum(ClinicalSpecialty)
  specialty?: ClinicalSpecialty;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional() @IsEnum(STATUSES)
  status?: CaseStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  search?: string;
}

// ─── Conduct ───

export class CreateOsceSessionDto {
  @ApiProperty() @IsString() examId!: string;
  @ApiProperty() @IsString() studentId!: string;

  @ApiPropertyOptional({ default: false, description: "Student conducts the exam themselves (AI patient + auto-grade)." })
  @IsOptional() @IsBoolean()
  selfConduct?: boolean;
}

export class CheckItemDto {
  @ApiProperty() @IsString() checklistItemId!: string;
  @ApiProperty() @IsBoolean() checked!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class OsceCheckDto {
  @ApiProperty({ type: [CheckItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckItemDto)
  items!: CheckItemDto[];

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  examinerComment?: string;
}

/** Free-text account of the student's actions for AI auto-grading. */
export class OsceAiGradeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(6000)
  transcript!: string;
}

/** One student message to the AI patient during self-conduct. */
export class OsceChatDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
