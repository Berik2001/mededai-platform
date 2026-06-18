import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AiModule } from "../ai/ai.module";
import {
  VirtualPatientSession,
  VirtualPatientSessionSchema,
} from "./schemas/virtual-patient-session.schema";
import { VirtualPatientService } from "./virtual-patient.service";
import { VirtualPatientController } from "./virtual-patient.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VirtualPatientSession.name, schema: VirtualPatientSessionSchema },
    ]),
    AiModule, // provides GeminiService
  ],
  controllers: [VirtualPatientController],
  providers: [VirtualPatientService],
  exports: [VirtualPatientService],
})
export class VirtualPatientModule {}
