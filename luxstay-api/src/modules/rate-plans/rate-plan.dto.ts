import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsEnum,
  IsDateString, IsUUID, Min, Max, MinLength, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MealPlan } from '../../common/enums';

export class CreateRatePlanDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiPropertyOptional({ description: 'Leave empty to apply this plan to all room types' })
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @ApiProperty({ example: 'Summer Saver 2025' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'summer-saver-25', description: 'Unique per property. Lowercase, letters, numbers, hyphens.' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'code must be lowercase letters, numbers and hyphens' })
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 199.00 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baseRate: number;

  @ApiPropertyOptional({ example: 10, description: 'Percentage discount (0–100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPercent?: number;

  @ApiPropertyOptional({ enum: MealPlan, default: MealPlan.RoomOnly })
  @IsOptional()
  @IsEnum(MealPlan)
  mealPlan?: MealPlan;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minNights?: number;

  @ApiPropertyOptional({ example: 7, description: 'Leave empty for no maximum' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxNights?: number;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2025-08-31' })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateRatePlanDto extends PartialType(CreateRatePlanDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RatePlanQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @ApiPropertyOptional({ enum: MealPlan })
  @IsOptional()
  @IsEnum(MealPlan)
  mealPlan?: MealPlan;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeInactive?: boolean;

  @ApiPropertyOptional({ example: '2025-07-15', description: 'Filter to plans valid on this date' })
  @IsOptional()
  @IsDateString()
  validOn?: string;
}
