import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import {
  CreateMaintenanceRequestDto,
  UpdateMaintenanceRequestDto,
  AssignMaintenanceDto,
  ResolveMaintenanceDto,
  UpdateMaintenanceStatusDto,
  MaintenanceQueryDto,
} from './maintenance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Maintenance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly svc: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'List maintenance requests' })
  list(@Query() query: MaintenanceQueryDto) {
    return this.svc.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request by ID' })
  getById(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create maintenance request' })
  create(@Body() dto: CreateMaintenanceRequestDto, @Request() req: any) {
    return this.svc.create(dto, req.user?.id);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Update maintenance request' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRequestDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/assign')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Assign request to staff' })
  assign(@Param('id') id: string, @Body() dto: AssignMaintenanceDto) {
    return this.svc.assign(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update request status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMaintenanceStatusDto) {
    return this.svc.updateStatus(id, dto);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve a maintenance request' })
  resolve(@Param('id') id: string, @Body() dto: ResolveMaintenanceDto) {
    return this.svc.resolve(id, dto);
  }

  @Patch(':id/close')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Close a resolved request' })
  close(@Param('id') id: string) {
    return this.svc.close(id);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Delete open request' })
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
