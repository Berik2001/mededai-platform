import { PartialType } from "@nestjs/swagger";
import { CreateCaseDto } from "./create-case.dto";

/** All fields optional; `content` (if present) is merged into existing content. */
export class UpdateCaseDto extends PartialType(CreateCaseDto) {}
