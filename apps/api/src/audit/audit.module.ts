import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { AppConfig } from "../config/configuration";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { AuditLogMiddleware } from "./audit-log.middleware";

@Module({
  imports: [
    // Own JwtModule so the middleware can verify access tokens before the guards run.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get("jwt", { infer: true }).accessSecret,
      }),
    }),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditLogMiddleware],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  // Applied here (not in AppModule) so the middleware resolves JwtService from this module's context.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditLogMiddleware).forRoutes("*");
  }
}
