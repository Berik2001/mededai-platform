import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { AssignmentTargetType } from "@med/shared";

const TARGET_TYPES = ["CASE", "TEST"] as const;

export class CreateGroupDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  memberIds?: string[];
}

export class UpdateGroupDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
}

export class AddMembersDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  userIds!: string[];
}

export class CreateAssignmentDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) instructions?: string;

  @ApiProperty({ enum: TARGET_TYPES })
  @IsEnum(TARGET_TYPES)
  targetType!: AssignmentTargetType;

  @ApiPropertyOptional({ description: "Required when targetType = CASE" })
  @IsOptional() @IsString()
  caseId?: string;

  @ApiPropertyOptional({ description: "Required when targetType = TEST" })
  @IsOptional() @IsString()
  testId?: string;

  @ApiProperty({ description: "Deadline (ISO 8601)" })
  @IsDateString()
  dueAt!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  studentIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  groupIds?: string[];
}

export class UpdateAssignmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueAt?: string;
}

export class ReviewSubmissionDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  grade?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  feedback?: string;
}
