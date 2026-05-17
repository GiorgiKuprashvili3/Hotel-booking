import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GuestsService } from './guests.service';
import {
  CreateGuestDto, UpdateGuestDto, BlacklistGuestDto,
  AdjustLoyaltyPointsDto, GuestQueryDto,
} from './guest.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Guests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  @ApiOperation({ summary: 'List guests (paginated, searchable)' })
  list(@Query() query: GuestQueryDto) {
    return this.guestsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get guest by ID' })
  getById(@Param('id') id: string) {
    return this.guestsService.getById(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Create a new guest profile' })
  create(@Body() dto: CreateGuestDto) {
    return this.guestsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Update a guest profile' })
  update(@Param('id') id: string, @Body() dto: UpdateGuestDto) {
    return this.guestsService.update(id, dto);
  }

  @Post(':id/blacklist')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Blacklist a guest' })
  blacklist(@Param('id') id: string, @Body() dto: BlacklistGuestDto) {
    return this.guestsService.blacklist(id, dto);
  }

  @Post(':id/unblacklist')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Remove a guest from the blacklist' })
  unblacklist(@Param('id') id: string) {
    return this.guestsService.unblacklist(id);
  }

  @Patch(':id/loyalty')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Adjust loyalty points and/or tier' })
  adjustLoyalty(@Param('id') id: string, @Body() dto: AdjustLoyaltyPointsDto) {
    return this.guestsService.adjustLoyaltyPoints(id, dto);
  }
}
