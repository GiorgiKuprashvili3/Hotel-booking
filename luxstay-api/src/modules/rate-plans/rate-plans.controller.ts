import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RatePlansService } from './rate-plans.service';
import { CreateRatePlanDto, UpdateRatePlanDto, RatePlanQueryDto } from './rate-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Rate Plans')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rate-plans')
export class RatePlansController {
  constructor(private readonly ratePlansService: RatePlansService) {}

  @Get()
  @ApiOperation({ summary: 'List rate plans (filterable by property, room type, date)' })
  list(@Query() query: RatePlanQueryDto) {
    return this.ratePlansService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rate plan by ID' })
  getById(@Param('id') id: string) {
    return this.ratePlansService.getById(id);
  }

  @Post()
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Create a rate plan' })
  create(@Body() dto: CreateRatePlanDto) {
    return this.ratePlansService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Update a rate plan' })
  update(@Param('id') id: string, @Body() dto: UpdateRatePlanDto) {
    return this.ratePlansService.update(id, dto);
  }

  @Post(':id/deactivate')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Deactivate a rate plan' })
  deactivate(@Param('id') id: string) {
    return this.ratePlansService.deactivate(id);
  }

  @Post(':id/reactivate')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Reactivate a rate plan' })
  reactivate(@Param('id') id: string) {
    return this.ratePlansService.reactivate(id);
  }
}
