import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsArray,
  IsUUID, IsEnum, Min, MinLength, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoomStatus, HousekeepingStatus } from '../../common/enums';

// ── Room Type DTOs ────────────────────────────────────────────────────────────

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'uuid-of-property' })
  @IsUUID()
  propertyId: string;

  @ApiProperty({ example: 'Deluxe King' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'DLX-K', description: 'Unique per property. Lowercase, letters, numbers, hyphens.' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'code must be lowercase letters, numbers and hyphens' })
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxOccupancy?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxAdults?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxChildren?: number;

  @ApiPropertyOptional({ example: '1 King Bed' })
  @IsOptional()
  @IsString()
  bedConfiguration?: string;

  @ApiPropertyOptional({ example: 35.5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sizeM2?: number;

  @ApiPropertyOptional({ type: [String], example: ['sea view', 'balcony'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiProperty({ example: 250.00 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baseRate: number;
}

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RoomTypeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by property UUID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeInactive?: boolean;
}

// ── Room DTOs ─────────────────────────────────────────────────────────────────

export class CreateRoomDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiProperty()
  @IsUUID()
  roomTypeId: string;

  @ApiProperty({ example: '101' })
  @IsString()
  @MinLength(1)
  number: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  floor: number;

  @ApiPropertyOptional({ enum: RoomStatus, default: RoomStatus.Available })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ enum: HousekeepingStatus, default: HousekeepingStatus.Clean })
  @IsOptional()
  @IsEnum(HousekeepingStatus)
  housekeepingStatus?: HousekeepingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'UUID of connecting room' })
  @IsOptional()
  @IsUUID()
  connectingRoomId?: string;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoomStatusDto {
  @ApiProperty({ enum: RoomStatus })
  @IsEnum(RoomStatus)
  status: RoomStatus;

  @ApiPropertyOptional({ enum: HousekeepingStatus })
  @IsOptional()
  @IsEnum(HousekeepingStatus)
  housekeepingStatus?: HousekeepingStatus;
}

export class RoomQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @ApiPropertyOptional({ enum: RoomStatus })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ enum: HousekeepingStatus })
  @IsOptional()
  @IsEnum(HousekeepingStatus)
  housekeepingStatus?: HousekeepingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  floor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeInactive?: boolean;
}
