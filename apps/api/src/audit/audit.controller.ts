import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@med/shared";
import { AuditService } from "./audit.service";
import { AuditQueryDto } from "./dto/audit-query.dto";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "List audit log entries (admin only, filtered + paginated)" })
  findAll(@Query() query: AuditQueryDto) {
    return this.audit.findAll(query);
  }
}
