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
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  UpdateReservationDto,
  CheckInDto,
  CheckOutDto,
  CancelReservationDto,
  ReservationQueryDto,
  AvailabilityQueryDto,
  CreateBookingGroupDto,
  UpdateBookingGroupDto,
  BookingGroupQueryDto,
} from './reservation.dto';

@ApiTags('Reservations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // ── Availability ─────────────────────────────────────────────────────────────

  @Get('reservations/availability')
  @ApiOperation({ summary: 'Check room availability for a date range' })
  checkAvailability(@Query() query: AvailabilityQueryDto) {
    return this.reservationsService.checkAvailability(query);
  }

  // ── Reservations ─────────────────────────────────────────────────────────────

  @Get('reservations')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist, Role.Accountant)
  @ApiOperation({ summary: 'List reservations with filters' })
  list(@Query() query: ReservationQueryDto) {
    return this.reservationsService.list(query);
  }

  @Get('reservations/by-confirmation/:code')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Get reservation by confirmation number' })
  @ApiParam({ name: 'code', example: 'RES-20250517-0042' })
  getByConfirmation(@Param('code') code: string) {
    return this.reservationsService.getByConfirmationNumber(code);
  }

  @Get('reservations/:id')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist, Role.Accountant)
  @ApiOperation({ summary: 'Get reservation by ID' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.getById(id);
  }

  @Post('reservations')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Create a new reservation' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: any) {
    return this.reservationsService.create(dto, user?.sub);
  }

  @Patch('reservations/:id')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Update reservation details (pre-arrival only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, dto);
  }

  // ── Check-in / Check-out ─────────────────────────────────────────────────────

  @Post('reservations/:id/check-in')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Perform guest check-in' })
  @HttpCode(HttpStatus.OK)
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @CurrentUser() user: any,
  ) {
    if (!dto.staffId && user?.sub) dto.staffId = user.sub;
    return this.reservationsService.checkIn(id, dto);
  }

  @Post('reservations/:id/check-out')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Perform guest check-out' })
  @HttpCode(HttpStatus.OK)
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckOutDto,
    @CurrentUser() user: any,
  ) {
    if (!dto.staffId && user?.sub) dto.staffId = user.sub;
    return this.reservationsService.checkOut(id, dto);
  }

  @Post('reservations/:id/cancel')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Cancel a reservation' })
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.cancel(id, dto);
  }

  @Post('reservations/:id/no-show')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Mark reservation as no-show' })
  @HttpCode(HttpStatus.OK)
  markNoShow(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.markNoShow(id);
  }

  // ── Booking Groups ────────────────────────────────────────────────────────────

  @Get('booking-groups')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'List booking groups' })
  listGroups(@Query() query: BookingGroupQueryDto) {
    return this.reservationsService.listGroups(query);
  }

  @Get('booking-groups/:id')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Get booking group by ID' })
  getGroupById(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.getGroupById(id);
  }

  @Post('booking-groups')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Create a booking group' })
  @ApiResponse({ status: 201 })
  createGroup(@Body() dto: CreateBookingGroupDto) {
    return this.reservationsService.createGroup(dto);
  }

  @Patch('booking-groups/:id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Update booking group' })
  updateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingGroupDto,
  ) {
    return this.reservationsService.updateGroup(id, dto);
  }

  @Delete('booking-groups/:id')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Deactivate booking group' })
  deactivateGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.deactivateGroup(id);
  }
}
