import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsEmail, IsBoolean, IsEnum,
  IsDateString, IsInt, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LoyaltyTier, GuestIdType } from '../../common/enums';

export class CreateGuestDto {
  @ApiProperty({ example: 'Giorgi' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Beridze' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ example: 'giorgi@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+995599123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'GE', description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: GuestIdType })
  @IsOptional()
  @IsEnum(GuestIdType)
  idType?: GuestIdType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Preferred language (ISO 639-1)' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGuestDto extends PartialType(CreateGuestDto) {}

export class BlacklistGuestDto {
  @ApiProperty({ example: 'Repeated no-shows and property damage' })
  @IsString()
  @MinLength(5)
  reason: string;
}

export class AdjustLoyaltyPointsDto {
  @ApiProperty({ example: 500, description: 'Points to add (positive) or deduct (negative)' })
  @IsInt()
  @Type(() => Number)
  points: number;

  @ApiProperty({ example: 'Manual adjustment by manager' })
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiPropertyOptional({ enum: LoyaltyTier })
  @IsOptional()
  @IsEnum(LoyaltyTier)
  newTier?: LoyaltyTier;
}

export class GuestQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, email, phone or ID number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: LoyaltyTier })
  @IsOptional()
  @IsEnum(LoyaltyTier)
  loyaltyTier?: LoyaltyTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isBlacklisted?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
