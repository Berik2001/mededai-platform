import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class LogoutDto {
  @ApiPropertyOptional({ description: "The refresh token to revoke for this session." })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: "Revoke every active session for the user.", default: false })
  @IsOptional()
  @IsBoolean()
  allDevices?: boolean;
}
