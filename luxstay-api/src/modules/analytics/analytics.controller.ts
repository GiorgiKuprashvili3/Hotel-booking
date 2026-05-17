import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.Manager, Role.Accountant)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('dashboard/:propertyId')
  @ApiOperation({ summary: 'Live dashboard KPIs for a property' })
  getDashboard(@Param('propertyId') propertyId: string) {
    return this.svc.getDashboard(propertyId);
  }

  @Get('snapshots/:propertyId')
  @ApiOperation({ summary: 'Historical daily snapshots' })
  @ApiQuery({ name: 'fromDate', example: '2025-06-01' })
  @ApiQuery({ name: 'toDate', example: '2025-06-30' })
  getSnapshots(
    @Param('propertyId') propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.svc.getSnapshots(propertyId, fromDate, toDate);
  }

  @Get('snapshots/:propertyId/:date')
  @ApiOperation({ summary: 'Get a single day snapshot' })
  getSnapshot(
    @Param('propertyId') propertyId: string,
    @Param('date') date: string,
  ) {
    return this.svc.getSnapshot(propertyId, date);
  }

  @Post('snapshots/:propertyId/:date/build')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Build or rebuild snapshot for a given date' })
  buildSnapshot(
    @Param('propertyId') propertyId: string,
    @Param('date') date: string,
  ) {
    return this.svc.buildSnapshot(propertyId, date);
  }

  @Get('occupancy/:propertyId')
  @ApiOperation({ summary: 'Occupancy, ADR & RevPAR trend over date range' })
  @ApiQuery({ name: 'fromDate', example: '2025-06-01' })
  @ApiQuery({ name: 'toDate', example: '2025-06-30' })
  getOccupancyTrend(
    @Param('propertyId') propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.svc.getOccupancyTrend(propertyId, fromDate, toDate);
  }

  @Get('revenue/:propertyId')
  @ApiOperation({ summary: 'Revenue summary over date range' })
  @ApiQuery({ name: 'fromDate', example: '2025-06-01' })
  @ApiQuery({ name: 'toDate', example: '2025-06-30' })
  getRevenueSummary(
    @Param('propertyId') propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.svc.getRevenueSummary(propertyId, fromDate, toDate);
  }
}
