import {
  IsString, IsOptional, IsEnum, IsInt, IsNumber,
  IsDateString, IsUUID, IsPositive, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ReservationStatus, BookingSource, MealPlan,
} from '../../common/enums';

// ── Booking Group DTOs ────────────────────────────────────────────────────────

export class CreateBookingGroupDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiProperty({ example: 'Smith Wedding Block' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  masterGuestId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateBookingGroupDto extends PartialType(CreateBookingGroupDto) {}

export class BookingGroupQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  propertyId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  includeInactive?: boolean;
}

// ── Reservation DTOs ─────────────────────────────────────────────────────────

export class CreateReservationDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiProperty()
  @IsUUID()
  roomId: string;

  @ApiProperty()
  @IsUUID()
  guestId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ratePlanId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  bookingGroupId?: string;

  @ApiProperty({ example: '2025-06-01' })
  @IsDateString()
  checkInDate: string;

  @ApiProperty({ example: '2025-06-05' })
  @IsDateString()
  checkOutDate: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  adults?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  children?: number;

  @ApiPropertyOptional({ enum: MealPlan })
  @IsEnum(MealPlan)
  @IsOptional()
  mealPlan?: MealPlan;

  @ApiPropertyOptional({ enum: BookingSource })
  @IsEnum(BookingSource)
  @IsOptional()
  source?: BookingSource;

  @ApiPropertyOptional({ example: 800.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional({ example: 200.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  specialRequests?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateReservationDto extends PartialType(CreateReservationDto) {}

export class CheckInDto {
  @ApiPropertyOptional({ description: 'Override actual check-in timestamp; defaults to now' })
  @IsOptional()
  @IsDateString()
  actualCheckInAt?: string;

  @ApiPropertyOptional({ description: 'Staff ID performing check-in' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional({ description: 'Override actual check-out timestamp; defaults to now' })
  @IsOptional()
  @IsDateString()
  actualCheckOutAt?: string;

  @ApiPropertyOptional({ description: 'Staff ID performing check-out' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
}

export class CancelReservationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cancellationReason?: string;
}

export class ReservationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  propertyId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  guestId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  bookingGroupId?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsEnum(ReservationStatus)
  @IsOptional()
  status?: ReservationStatus;

  @ApiPropertyOptional({ enum: BookingSource })
  @IsEnum(BookingSource)
  @IsOptional()
  source?: BookingSource;

  /** Filter reservations that overlap with this date range */
  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Search by confirmation number or guest name' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class AvailabilityQueryDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiProperty({ example: '2025-06-01' })
  @IsDateString()
  checkInDate: string;

  @ApiProperty({ example: '2025-06-05' })
  @IsDateString()
  checkOutDate: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  roomTypeId?: string;
}
