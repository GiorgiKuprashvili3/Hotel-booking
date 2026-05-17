import {
  IsString, IsOptional, IsEnum, IsNumber,
  IsDateString, IsUUID, IsBoolean, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../common/enums';
import { FolioItemType, FolioItemCategory } from './folio-item.entity';
import { FolioStatus } from './folio.entity';

// ── Folio creation ────────────────────────────────────────────────────────────

export class CreateFolioDto {
  @ApiProperty()
  @IsUUID()
  reservationId: string;

  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

// ── Folio item (charge or payment) ────────────────────────────────────────────

export class AddFolioItemDto {
  @ApiProperty({ enum: FolioItemType })
  @IsEnum(FolioItemType)
  type: FolioItemType;

  @ApiProperty({ enum: FolioItemCategory })
  @IsEnum(FolioItemCategory)
  category: FolioItemCategory;

  @ApiProperty({ example: 'Room charge – night of 2025-06-01' })
  @IsString()
  description: string;

  /**
   * Positive = charge / tax.
   * Negative = payment / credit / discount.
   */
  @ApiProperty({ example: 200.0 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: '2025-06-01' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paymentReference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AddRoomChargesDto {
  @ApiProperty({
    description: 'Post nightly room charges between these dates (inclusive start, exclusive end)',
    example: '2025-06-01',
  })
  @IsDateString()
  fromDate: string;

  @ApiProperty({ example: '2025-06-05' })
  @IsDateString()
  toDate: string;

  @ApiProperty({ example: 200.0, description: 'Rate per night' })
  @IsNumber()
  @Min(0)
  ratePerNight: number;

  @ApiPropertyOptional({ description: 'Description prefix, defaults to "Room charge"' })
  @IsString()
  @IsOptional()
  descriptionPrefix?: string;
}

export class RecordPaymentDto {
  @ApiProperty({ example: 400.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'TXN-987654' })
  @IsString()
  @IsOptional()
  paymentReference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class VoidFolioItemDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

export class FolioQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  reservationId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  propertyId?: string;

  @ApiPropertyOptional({ enum: FolioStatus })
  @IsEnum(FolioStatus)
  @IsOptional()
  status?: FolioStatus;
}
