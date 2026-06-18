import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { resolve } from "path";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";
import { UPLOAD_DIR } from "./tests/uploads.controller";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);

  // Trust the reverse proxy so req.ip and req.secure reflect X-Forwarded-* headers.
  app.set("trust proxy", 1);

  // helmet sets HSTS (and other security headers) by default. Allow cross-origin
  // image loads so the web app (:3000) can render uploaded ECG/radiology images.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // Serve uploaded images at /uploads (outside the global /api prefix).
  // resolve() honours an absolute UPLOAD_DIR and otherwise anchors to cwd —
  // matching where Multer (diskStorage) writes.
  app.useStaticAssets(resolve(UPLOAD_DIR), { prefix: "/uploads/" });
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: config.get("corsOrigins", { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("AI Medical Education Platform API")
    .setDescription("REST API for the AI Medical Education Platform")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = config.get("port", { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}/api (docs: /api/docs)`);
}

void bootstrap();
