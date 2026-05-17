import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import {
  CreateRoomTypeDto, UpdateRoomTypeDto, RoomTypeQueryDto,
  CreateRoomDto, UpdateRoomDto, UpdateRoomStatusDto, RoomQueryDto,
} from './room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

// ── Room Types ────────────────────────────────────────────────────────────────

@ApiTags('Room Types')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all room types' })
  list(@Query() query: RoomTypeQueryDto) {
    return this.roomsService.listRoomTypes(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room type by ID' })
  getById(@Param('id') id: string) {
    return this.roomsService.getRoomTypeById(id);
  }

  @Post()
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Create a room type' })
  create(@Body() dto: CreateRoomTypeDto) {
    return this.roomsService.createRoomType(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Update a room type' })
  update(@Param('id') id: string, @Body() dto: UpdateRoomTypeDto) {
    return this.roomsService.updateRoomType(id, dto);
  }

  @Post(':id/deactivate')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Deactivate a room type' })
  deactivate(@Param('id') id: string) {
    return this.roomsService.deactivateRoomType(id);
  }

  @Post(':id/reactivate')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Reactivate a room type' })
  reactivate(@Param('id') id: string) {
    return this.roomsService.reactivateRoomType(id);
  }
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

@ApiTags('Rooms')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms' })
  list(@Query() query: RoomQueryDto) {
    return this.roomsService.listRooms(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  getById(@Param('id') id: string) {
    return this.roomsService.getRoomById(id);
  }

  @Post()
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Create a room' })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Update a room' })
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.updateRoom(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist, Role.Housekeeper)
  @ApiOperation({ summary: 'Update room status / housekeeping status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRoomStatusDto) {
    return this.roomsService.updateRoomStatus(id, dto);
  }

  @Post(':id/deactivate')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Deactivate a room' })
  deactivate(@Param('id') id: string) {
    return this.roomsService.deactivateRoom(id);
  }

  @Post(':id/reactivate')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Reactivate a room' })
  reactivate(@Param('id') id: string) {
    return this.roomsService.reactivateRoom(id);
  }
}
