import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Role } from "@med/shared";

export class RegisterDto {
  @ApiProperty({ example: "student@med.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Password123!", minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: "Sam" })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: "Student" })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional({ enum: Role, default: Role.STUDENT })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: "State Medical University" })
  @IsOptional()
  @IsString()
  institution?: string;
}
