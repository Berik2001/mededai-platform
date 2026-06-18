import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { diskStorage } from "multer";
import { randomUUID } from "crypto";
import { extname } from "path";
import { mkdirSync } from "fs";
import { Role, UploadResult } from "@med/shared";
import { Roles } from "../auth/decorators/roles.decorator";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";
mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = /^image\/(png|jpe?g|webp|gif)$/;

@ApiTags("uploads")
@ApiBearerAuth()
@Roles(Role.TEACHER, Role.ADMIN)
@Controller("uploads")
export class UploadsController {
  @Post("image")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload an image (ECG / radiology / diagnosis); returns its URL" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) =>
          cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        ALLOWED.test(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException("Only PNG/JPEG/WebP/GIF images are allowed"), false),
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File): UploadResult {
    if (!file) throw new BadRequestException("No file uploaded");
    return { url: `/uploads/${file.filename}` };
  }
}
