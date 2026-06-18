import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
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

export class CreateVPSessionDto {
  @ApiPropertyOptional({ enum: SPECIALTIES })
  @IsOptional()
  @IsEnum(SPECIALTIES)
  specialty?: MedicalSpecialty;

  @ApiPropertyOptional({ enum: DIFFICULTIES })
  @IsOptional()
  @IsEnum(DIFFICULTIES)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ description: "Optional clinical topic to focus the scenario." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;
}

export class VPMessageDto {
  @ApiProperty({ description: "What the clinician says/asks the patient." })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class VPExamDto {
  @ApiProperty({ example: "Troponin", description: "Name of the lab/imaging/examination to order." })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class VPTreatmentDto {
  @ApiProperty({ example: "Aspirin" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "300 mg PO" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosage?: string;
}

export class VPDiagnosisDto {
  @ApiProperty({ example: "Acute myocardial infarction" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  value!: string;
}
