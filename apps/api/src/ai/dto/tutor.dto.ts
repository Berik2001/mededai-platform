import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type { ChatRole } from "@med/shared";

class ChatMessageDto {
  @ApiProperty({ enum: ["system", "user", "assistant"] })
  @IsEnum(["system", "user", "assistant"] as const)
  role!: ChatRole;

  @ApiProperty()
  @IsString()
  content!: string;
}

export class TutorDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @ApiPropertyOptional({ description: "Ground the conversation in a specific case id" })
  @IsOptional()
  @IsString()
  caseId?: string;
}
