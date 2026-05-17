import {
  IsEnum, IsString, IsOptional, IsDateString,
  IsInt, Min, IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { HousekeepingStatus } from '../../common/enums';
import { HousekeepingTaskType } from './housekeeping-task.entity';

export class CreateHousekeepingTaskDto {
  @ApiProperty() @IsUUID() propertyId: string;
  @ApiProperty() @IsUUID() roomId: string;

  @ApiPropertyOptional({ enum: HousekeepingTaskType })
  @IsEnum(HousekeepingTaskType) @IsOptional()
  taskType?: HousekeepingTaskType;

  @ApiProperty({ example: '2025-06-01' })
  @IsDateString() scheduledDate: string;

  @ApiPropertyOptional() @IsUUID() @IsOptional() assignedToId?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() estimatedMinutes?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() priority?: number;
}

export class UpdateHousekeepingTaskDto extends PartialType(CreateHousekeepingTaskDto) {}

export class AssignHousekeepingTaskDto {
  @ApiProperty() @IsUUID() assignedToId: string;
}

export class UpdateHousekeepingStatusDto {
  @ApiProperty({ enum: HousekeepingStatus }) @IsEnum(HousekeepingStatus) status: HousekeepingStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class InspectRoomDto {
  @ApiProperty({ enum: HousekeepingStatus, description: 'Clean | Inspected | Dirty' })
  @IsEnum(HousekeepingStatus) status: HousekeepingStatus;

  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class HousekeepingQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() propertyId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() roomId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assignedToId?: string;
  @ApiPropertyOptional({ enum: HousekeepingStatus }) @IsEnum(HousekeepingStatus) @IsOptional() status?: HousekeepingStatus;
  @ApiPropertyOptional({ enum: HousekeepingTaskType }) @IsEnum(HousekeepingTaskType) @IsOptional() taskType?: HousekeepingTaskType;
  @ApiPropertyOptional() @IsDateString() @IsOptional() scheduledDate?: string;
}
