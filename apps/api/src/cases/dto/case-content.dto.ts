import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class CasePatientDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsInt() @Min(0) age!: number;
  @ApiProperty({ enum: ["MALE", "FEMALE", "OTHER"] })
  @IsEnum(["MALE", "FEMALE", "OTHER"] as const)
  sex!: "MALE" | "FEMALE" | "OTHER";
}

export class CaseVitalsDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() heartRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() bloodPressure?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() respiratoryRate?: number;
  @ApiPropertyOptional() @IsOptional() temperatureC?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() oxygenSaturation?: number;
}

export class ClinicalPathwayStepDto {
  @ApiProperty() @IsInt() order!: number;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() detail!: string;
}

export class CaseExamFindingDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiProperty() @IsString() result!: string;
  @ApiProperty() @IsBoolean() abnormal!: boolean;
}

export class CaseContentDto {
  @ApiProperty({ type: CasePatientDto })
  @ValidateNested()
  @Type(() => CasePatientDto)
  patient!: CasePatientDto;

  @ApiProperty() @IsString() initialComplaint!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() presentation?: string;

  @ApiPropertyOptional({ type: CaseVitalsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CaseVitalsDto)
  initialVitals?: CaseVitalsDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() learningObjectives?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() references?: string[];

  // Hidden teaching key
  @ApiPropertyOptional() @IsOptional() @IsString() fullBackground?: string;

  @ApiProperty() @IsString() hiddenDiagnosis!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() diagnosisSynonyms?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() differentialDiagnoses?: string[];

  @ApiPropertyOptional({ type: [ClinicalPathwayStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClinicalPathwayStepDto)
  clinicalPathway?: ClinicalPathwayStepDto[];

  @ApiPropertyOptional({ type: [CaseExamFindingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseExamFindingDto)
  examFindings?: CaseExamFindingDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() correctTreatments?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() contraindicatedTreatments?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() redFlags?: string[];
}
