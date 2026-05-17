import {
  IsEnum, IsString, IsOptional, IsBoolean,
  IsNumber, IsUUID, IsDateString, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MaintenancePriority, MaintenanceStatus } from '../../common/enums';
import { MaintenanceCategory } from './maintenance-request.entity';

export class CreateMaintenanceRequestDto {
  @ApiProperty() @IsUUID() propertyId: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() roomId?: string;
  @ApiProperty() @IsString() @MinLength(3) title: string;
  @ApiProperty() @IsString() @MinLength(5) description: string;

  @ApiPropertyOptional({ enum: MaintenanceCategory })
  @IsEnum(MaintenanceCategory) @IsOptional()
  category?: MaintenanceCategory;

  @ApiPropertyOptional({ enum: MaintenancePriority })
  @IsEnum(MaintenancePriority) @IsOptional()
  priority?: MaintenancePriority;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() requiresRoomBlocked?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() estimatedCost?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class UpdateMaintenanceRequestDto extends PartialType(CreateMaintenanceRequestDto) {}

export class AssignMaintenanceDto {
  @ApiProperty() @IsUUID() assignedToId: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() scheduledAt?: string;
}

export class ResolveMaintenanceDto {
  @ApiProperty() @IsString() resolutionNotes: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() actualCost?: number;
}

export class UpdateMaintenanceStatusDto {
  @ApiProperty({ enum: MaintenanceStatus }) @IsEnum(MaintenanceStatus) status: MaintenanceStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class MaintenanceQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() propertyId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() roomId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assignedToId?: string;
  @ApiPropertyOptional({ enum: MaintenanceStatus }) @IsEnum(MaintenanceStatus) @IsOptional() status?: MaintenanceStatus;
  @ApiPropertyOptional({ enum: MaintenancePriority }) @IsEnum(MaintenancePriority) @IsOptional() priority?: MaintenancePriority;
  @ApiPropertyOptional({ enum: MaintenanceCategory }) @IsEnum(MaintenanceCategory) @IsOptional() category?: MaintenanceCategory;
}
