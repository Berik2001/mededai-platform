import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class AuditQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional() @IsString() userId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() method?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() statusCode?: number;
}
