import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HousekeepingService } from './housekeeping.service';
import {
  CreateHousekeepingTaskDto,
  UpdateHousekeepingTaskDto,
  AssignHousekeepingTaskDto,
  UpdateHousekeepingStatusDto,
  InspectRoomDto,
  HousekeepingQueryDto,
} from './housekeeping.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Housekeeping')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('housekeeping')
export class HousekeepingController {
  constructor(private readonly svc: HousekeepingService) {}

  @Get()
  @ApiOperation({ summary: 'List housekeeping tasks' })
  list(@Query() query: HousekeepingQueryDto) {
    return this.svc.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  getById(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Create housekeeping task' })
  create(@Body() dto: CreateHousekeepingTaskDto) {
    return this.svc.create(dto);
  }

  @Post('generate-daily')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Auto-generate daily tasks for dirty rooms' })
  generateDaily(@Body() body: { propertyId: string; date: string }) {
    return this.svc.generateDailyTasks(body.propertyId, body.date);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Update task' })
  update(@Param('id') id: string, @Body() dto: UpdateHousekeepingTaskDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/assign')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Assign task to housekeeper' })
  assign(@Param('id') id: string, @Body() dto: AssignHousekeepingTaskDto) {
    return this.svc.assign(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status (housekeeper marks in-progress / clean)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateHousekeepingStatusDto,
    @Request() req: any,
  ) {
    return this.svc.updateStatus(id, dto, req.user?.id);
  }

  @Patch(':id/inspect')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Inspect a cleaned room' })
  inspect(@Param('id') id: string, @Body() dto: InspectRoomDto, @Request() req: any) {
    return this.svc.inspect(id, dto, req.user?.id);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Delete task' })
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
