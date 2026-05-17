import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiParam, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';
import { FolioService } from './folio.service';
import {
  CreateFolioDto,
  AddFolioItemDto,
  AddRoomChargesDto,
  RecordPaymentDto,
  VoidFolioItemDto,
  FolioQueryDto,
} from './folio.dto';

@ApiTags('Folio & Payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('folios')
export class FolioController {
  constructor(private readonly folioService: FolioService) {}

  // ── Folio CRUD ────────────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.Admin, Role.Manager, Role.Receptionist, Role.Accountant)
  @ApiOperation({ summary: 'List folios' })
  list(@Query() query: FolioQueryDto) {
    return this.folioService.list(query);
  }

  @Get('by-reservation/:reservationId')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist, Role.Accountant)
  @ApiOperation({ summary: 'Get folio for a reservation' })
  getByReservation(@Param('reservationId', ParseUUIDPipe) reservationId: string) {
    return this.folioService.getByReservation(reservationId);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist, Role.Accountant)
  @ApiOperation({ summary: 'Get folio by ID (with all line items)' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.folioService.getById(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Open a new folio for a reservation' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateFolioDto) {
    return this.folioService.create(dto);
  }

  // ── Line items ────────────────────────────────────────────────────────────────

  @Post(':id/items')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Post a charge, credit, or tax line to the folio' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddFolioItemDto,
    @CurrentUser() user: any,
  ) {
    return this.folioService.addItem(id, dto, user?.sub);
  }

  @Post(':id/room-charges')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Post nightly room charges for a date range' })
  addRoomCharges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddRoomChargesDto,
    @CurrentUser() user: any,
  ) {
    return this.folioService.addRoomCharges(id, dto, user?.sub);
  }

  @Post(':id/payments')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist, Role.Accountant)
  @ApiOperation({ summary: 'Record a payment against the folio' })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.folioService.recordPayment(id, dto, user?.sub);
  }

  @Patch(':id/items/:itemId/void')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Void a specific folio line item' })
  voidItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: VoidFolioItemDto,
    @CurrentUser() user: any,
  ) {
    return this.folioService.voidItem(id, itemId, dto, user?.sub);
  }

  // ── Folio lifecycle ───────────────────────────────────────────────────────────

  @Post(':id/close')
  @Roles(Role.Admin, Role.Manager, Role.Accountant)
  @ApiOperation({ summary: 'Close the folio (requires zero balance)' })
  @HttpCode(HttpStatus.OK)
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.folioService.close(id);
  }

  @Post(':id/void')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Void the entire folio' })
  @HttpCode(HttpStatus.OK)
  void(@Param('id', ParseUUIDPipe) id: string) {
    return this.folioService.void(id);
  }
}
