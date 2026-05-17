import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditService, AuditQueryDto } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, AuditAction, AuditEntityType } from '../../common/enums';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.Manager)
@Controller('audit')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit logs with filters' })
  @ApiQuery({ name: 'entityType', enum: AuditEntityType, required: false })
  @ApiQuery({ name: 'action', enum: AuditAction, required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'performedById', required: false })
  @ApiQuery({ name: 'propertyId', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  query(@Query() query: AuditQueryDto) {
    return this.svc.query(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single audit log entry' })
  getById(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Full history for a specific entity' })
  getEntityHistory(
    @Param('entityType') entityType: AuditEntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.svc.getEntityHistory(entityType, entityId);
  }
}
