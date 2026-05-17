import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
} from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import {
  CreatePropertyDto, UpdatePropertyDto, PropertyQueryDto,
} from './property.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Properties')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all properties' })
  list(@Query() query: PropertyQueryDto) {
    return this.propertiesService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property by ID' })
  getById(@Param('id') id: string) {
    return this.propertiesService.getById(id);
  }

  @Post()
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Create a new property' })
  create(@Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Update a property' })
  update(@Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(id, dto);
  }

  @Post(':id/deactivate')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Deactivate a property' })
  deactivate(@Param('id') id: string) {
    return this.propertiesService.deactivate(id);
  }

  @Post(':id/reactivate')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Reactivate a property' })
  reactivate(@Param('id') id: string) {
    return this.propertiesService.reactivate(id);
  }
}
