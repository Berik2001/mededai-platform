import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService, SessionMeta } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { LogoutDto } from "./dto/logout.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentUser, AuthenticatedUser } from "./decorators/current-user.decorator";
import { ReqMeta } from "./decorators/request-meta.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Create an account; returns access + refresh tokens" })
  register(@Body() dto: RegisterDto, @ReqMeta() meta: SessionMeta) {
    return this.authService.register(dto, meta);
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Authenticate; returns access + refresh tokens" })
  login(@Body() dto: LoginDto, @ReqMeta() meta: SessionMeta) {
    return this.authService.login(dto, meta);
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Exchange a refresh token for a new token pair (rotation)" })
  refresh(@Body() dto: RefreshDto, @ReqMeta() meta: SessionMeta) {
    return this.authService.refresh(dto.refreshToken, meta);
  }

  @Post("logout")
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke the current refresh token (or all sessions)" })
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user.id, dto.refreshToken, dto.allDevices);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the current authenticated user (from token)" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
