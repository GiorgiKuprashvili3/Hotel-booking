import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConciergeService } from './concierge.service';
import {
  CreateConciergeRequestDto,
  UpdateConciergeRequestDto,
  AssignConciergeDto,
  UpdateConciergeStatusDto,
  ConciergeQueryDto,
} from './concierge.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Concierge')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('concierge')
export class ConciergeController {
  constructor(private readonly svc: ConciergeService) {}

  @Get()
  @ApiOperation({ summary: 'List concierge requests' })
  list(@Query() query: ConciergeQueryDto) {
    return this.svc.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request by ID' })
  getById(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create concierge request' })
  create(@Body() dto: CreateConciergeRequestDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update concierge request' })
  update(@Param('id') id: string, @Body() dto: UpdateConciergeRequestDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/assign')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Assign request to staff' })
  assign(@Param('id') id: string, @Body() dto: AssignConciergeDto) {
    return this.svc.assign(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update request status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateConciergeStatusDto) {
    return this.svc.updateStatus(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Delete concierge request' })
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
