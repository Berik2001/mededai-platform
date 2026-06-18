import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { VirtualPatientService, StreamSink } from "./virtual-patient.service";
import {
  CreateVPSessionDto,
  VPDiagnosisDto,
  VPExamDto,
  VPMessageDto,
  VPTreatmentDto,
} from "./dto/virtual-patient.dto";
import { CurrentUser, AuthenticatedUser } from "../auth/decorators/current-user.decorator";

@ApiTags("virtual-patient")
@ApiBearerAuth()
@Controller("virtual-patient/sessions")
export class VirtualPatientController {
  constructor(private readonly service: VirtualPatientService) {}

  @Post()
  @ApiOperation({ summary: "Start a new virtual patient encounter" })
  create(@Body() dto: CreateVPSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: "List my virtual patient sessions" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a session (student-safe view)" })
  get(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }

  @Post(":id/message")
  @ApiOperation({ summary: "Ask the patient something (anamnesis) — streams the reply (SSE)" })
  async message(
    @Param("id") id: string,
    @Body() dto: VPMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const sink = this.sseSink(res);
    await this.service.streamPatientReply(id, user, dto.content, sink);
  }

  @Post(":id/treatment")
  @ApiOperation({ summary: "Prescribe a treatment — streams the patient's reaction (SSE)" })
  async treatment(
    @Param("id") id: string,
    @Body() dto: VPTreatmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const sink = this.sseSink(res);
    await this.service.streamTreatment(id, user, dto.name, dto.dosage, sink);
  }

  @Post(":id/exam")
  @ApiOperation({ summary: "Order an examination / lab / imaging" })
  orderExam(
    @Param("id") id: string,
    @Body() dto: VPExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.orderExam(id, user, dto.name);
  }

  @Post(":id/diagnosis")
  @ApiOperation({ summary: "Submit a diagnosis (evaluated, does not end the session)" })
  diagnosis(
    @Param("id") id: string,
    @Body() dto: VPDiagnosisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submitDiagnosis(id, user, dto.value);
  }

  @Post(":id/finalize")
  @ApiOperation({ summary: "Finalize the encounter and get a scored debrief" })
  finalize(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.finalize(id, user);
  }

  /** Wire an Express response as a Server-Sent-Events sink. */
  private sseSink(res: Response): StreamSink {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering
    res.flushHeaders?.();

    const write = (event: string | null, data: unknown) => {
      if (event) res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    return {
      onDelta: (text) => write(null, { type: "delta", text }),
      onDone: (payload) => {
        write("done", { type: "done", ...payload });
        res.end();
      },
      onError: (message) => {
        write("error", { type: "error", message });
        res.end();
      },
    };
  }
}
