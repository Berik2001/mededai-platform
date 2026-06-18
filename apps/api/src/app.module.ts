import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_GUARD } from "@nestjs/core";
import configuration, { AppConfig } from "./config/configuration";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CasesModule } from "./cases/cases.module";
import { AiModule } from "./ai/ai.module";
import { VirtualPatientModule } from "./virtual-patient/virtual-patient.module";
import { TestsModule } from "./tests/tests.module";
import { AssignmentsModule } from "./assignments/assignments.module";
import { OsceModule } from "./osce/osce.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { TutorModule } from "./tutor/tutor.module";
import { AdminModule } from "./admin/admin.module";
import { AuditModule } from "./audit/audit.module";
import { BackupModule } from "./backup/backup.module";
import { HealthController } from "./health.controller";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";
import { HttpsEnforcementMiddleware } from "./common/middleware/https-enforcement.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [".env", "../../.env"],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        uri: config.get("mongodbUri", { infer: true }),
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CasesModule,
    AiModule,
    VirtualPatientModule,
    TestsModule,
    AssignmentsModule,
    OsceModule,
    AnalyticsModule,
    TutorModule,
    AuditModule,
    BackupModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global auth: every route requires a valid JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global RBAC: enforces @Roles() metadata where present.
    { provide: APP_GUARD, useClass: RolesGuard },
    HttpsEnforcementMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // TLS enforcement runs globally; AuditLogMiddleware is wired up in AuditModule
    // (so it can resolve JwtService from that module's context).
    consumer.apply(HttpsEnforcementMiddleware).forRoutes("*");
  }
}
