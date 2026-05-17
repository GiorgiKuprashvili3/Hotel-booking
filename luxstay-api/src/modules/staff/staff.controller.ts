import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
} from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { InviteStaffDto, UpdateStaffDto, StaffQueryDto } from './staff.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, RequirePermissions } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Permission } from '../../common/enums';

@ApiTags('Staff')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @RequirePermissions(Permission.ViewStaff)
  @ApiOperation({ summary: 'List all active staff' })
  list(@Query() query: StaffQueryDto) {
    return this.staffService.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.ViewStaff)
  @ApiOperation({ summary: 'Get staff member by ID' })
  getById(@Param('id') id: string) {
    return this.staffService.getById(id);
  }

  @Post('invite')
  @RequirePermissions(Permission.ManageStaff)
  @ApiOperation({ summary: 'Invite a new staff member' })
  invite(
    @Body() dto: InviteStaffDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.staffService.invite(dto, currentUserId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ManageStaff)
  @ApiOperation({ summary: 'Update staff member' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }

  @Post(':id/deactivate')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Deactivate (soft-delete) a staff member' })
  deactivate(@Param('id') id: string) {
    return this.staffService.deactivate(id);
  }
}
