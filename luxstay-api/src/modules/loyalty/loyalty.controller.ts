import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyTransactionType } from './loyalty-ledger.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

class ManualAdjustDto {
  @ApiProperty() @IsUUID() guestId: string;
  @ApiProperty() @IsInt() points: number;
  @ApiProperty({ enum: LoyaltyTransactionType }) @IsEnum(LoyaltyTransactionType) type: LoyaltyTransactionType;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() reservationId?: string;
}

class EarnFromStayDto {
  @ApiProperty() @IsUUID() guestId: string;
  @ApiProperty() @IsUUID() reservationId: string;
  @ApiProperty() @Min(0) amountSpent: number;
}

class RedeemDto {
  @ApiProperty() @IsUUID() guestId: string;
  @ApiProperty() @IsInt() @Min(1) points: number;
  @ApiPropertyOptional() @IsUUID() @IsOptional() reservationId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}

@ApiTags('Loyalty')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly svc: LoyaltyService) {}

  @Get('guests/:guestId/balance')
  @ApiOperation({ summary: 'Get guest loyalty balance and tier info' })
  getBalance(@Param('guestId') guestId: string) {
    return this.svc.getBalance(guestId);
  }

  @Get('guests/:guestId/ledger')
  @ApiOperation({ summary: 'Get full points ledger for a guest' })
  getLedger(@Param('guestId') guestId: string) {
    return this.svc.getLedger(guestId);
  }

  @Post('earn')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Earn points from a completed stay' })
  earnFromStay(@Body() dto: EarnFromStayDto, @Request() req: any) {
    return this.svc.earnFromStay({ ...dto, createdById: req.user?.id });
  }

  @Post('redeem')
  @Roles(Role.Admin, Role.Manager, Role.Receptionist)
  @ApiOperation({ summary: 'Redeem points for a guest' })
  redeem(@Body() dto: RedeemDto, @Request() req: any) {
    return this.svc.redeemPoints({ ...dto, createdById: req.user?.id });
  }

  @Post('adjust')
  @Roles(Role.Admin, Role.Manager)
  @ApiOperation({ summary: 'Manually adjust guest points (admin)' })
  adjust(@Body() dto: ManualAdjustDto, @Request() req: any) {
    return this.svc.adjustPoints({ ...dto, createdById: req.user?.id });
  }
}
