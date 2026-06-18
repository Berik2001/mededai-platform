import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CaseContent, CaseContentSchema } from "./schemas/case-content.schema";
import { CasesService } from "./cases.service";
import { CasesController } from "./cases.controller";
import { VirtualPatientModule } from "../virtual-patient/virtual-patient.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CaseContent.name, schema: CaseContentSchema }]),
    VirtualPatientModule, // provides VirtualPatientService for case → VP launch
  ],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
