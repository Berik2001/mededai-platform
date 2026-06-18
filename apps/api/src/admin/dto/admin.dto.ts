import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Role } from "@med/shared";
import type { AdminUserStatusFilter, ModerationDecision, ModerationType } from "@med/shared";

const STATUS_FILTERS = ["all", "active", "blocked"] as const;
const MOD_TYPES = ["CASE", "TEST", "ALL"] as const;
const CASE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const DECISIONS = ["APPROVE", "REJECT", "UNPUBLISH"] as const;

export class AdminCreateUserDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(72) password!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @ApiProperty({ enum: Role }) @IsEnum(Role) role!: Role;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) institution?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) yearOfStudy?: number;
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) role?: Role;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) institution?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) yearOfStudy?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AdminListUsersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 20;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional() @IsEnum(Role) role?: Role;

  @ApiPropertyOptional()
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({ enum: STATUS_FILTERS, default: "all" })
  @IsOptional() @IsEnum(STATUS_FILTERS) status?: AdminUserStatusFilter;
}

export class ModerationQueryDto {
  @ApiPropertyOptional({ enum: MOD_TYPES, default: "ALL" })
  @IsOptional() @IsEnum(MOD_TYPES) type?: ModerationType | "ALL";

  @ApiPropertyOptional({ enum: CASE_STATUSES })
  @IsOptional() @IsEnum(CASE_STATUSES) status?: (typeof CASE_STATUSES)[number];
}

export class ModerationDecisionDto {
  @ApiProperty({ enum: DECISIONS })
  @IsEnum(DECISIONS) decision!: ModerationDecision;
}
