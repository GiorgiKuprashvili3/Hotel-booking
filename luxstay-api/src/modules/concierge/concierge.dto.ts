import {
  IsEnum, IsString, IsOptional, IsNumber,
  IsUUID, IsDateString, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ConciergeRequestType, ConciergeStatus } from '../../common/enums';

export class CreateConciergeRequestDto {
  @ApiProperty() @IsUUID() propertyId: string;
  @ApiProperty() @IsUUID() reservationId: string;
  @ApiProperty() @IsUUID() guestId: string;

  @ApiProperty({ enum: ConciergeRequestType })
  @IsEnum(ConciergeRequestType) requestType: ConciergeRequestType;

  @ApiProperty() @IsString() details: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() requestedAt?: string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() charge?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() priority?: number;
}

export class UpdateConciergeRequestDto extends PartialType(CreateConciergeRequestDto) {}

export class AssignConciergeDto {
  @ApiProperty() @IsUUID() assignedToId: string;
}

export class UpdateConciergeStatusDto {
  @ApiProperty({ enum: ConciergeStatus }) @IsEnum(ConciergeStatus) status: ConciergeStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() staffNotes?: string;
}

export class ConciergeQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() propertyId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() reservationId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() guestId?: string;
  @ApiPropertyOptional({ enum: ConciergeStatus }) @IsEnum(ConciergeStatus) @IsOptional() status?: ConciergeStatus;
  @ApiPropertyOptional({ enum: ConciergeRequestType }) @IsEnum(ConciergeRequestType) @IsOptional() requestType?: ConciergeRequestType;
}
