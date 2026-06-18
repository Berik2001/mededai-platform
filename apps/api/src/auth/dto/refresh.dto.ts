import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RefreshDto {
  @ApiProperty({ description: "The refresh token issued at login/refresh." })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
